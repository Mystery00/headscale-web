import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHeadscaleHttp } from '@/api/http'
import { createAuthRepository } from '@/repositories/auth-repository'
import { server } from '../msw/server'

const BASE_URL = 'http://hs.example.com'
const authId = 'hskey-authreq-abcdefghijklmnopqrstuvwx'
const user = { id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' }
const node = {
  id: '42',
  name: 'laptop',
  givenName: 'alice-laptop',
  user,
  createdAt: '2024-01-02T03:04:05Z',
}

function repo() {
  return createAuthRepository(
    createHeadscaleHttp({ getBaseUrl: () => BASE_URL, getApiKey: () => 'test-key' }),
  )
}

describe('AuthRepository', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('registers a pending node under a user', async () => {
    let payload: unknown
    server.use(
      http.post(`${BASE_URL}/api/v1/auth/register`, async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({ node })
      }),
    )
    expect((await repo().register({ authId, userName: 'alice' })).id).toBe('42')
    expect(payload).toEqual({ authId, user: 'alice' })
  })

  it.each([
    ['approve', '/api/v1/auth/approve'],
    ['reject', '/api/v1/auth/reject'],
  ] as const)('sends %s with only the Auth ID', async (method, path) => {
    let payload: unknown
    server.use(
      http.post(`${BASE_URL}${path}`, async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({})
      }),
    )
    await repo()[method](authId)
    expect(payload).toEqual({ authId })
  })

  it('rejects a register response without a node', async () => {
    server.use(http.post(`${BASE_URL}/api/v1/auth/register`, () => HttpResponse.json({})))
    await expect(repo().register({ authId, userName: 'alice' })).rejects.toThrow('missing node')
  })
})
