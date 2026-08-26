import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHeadscaleHttp } from '@/api/http'
import { createUsersRepository } from '@/repositories/users-repository'
import { server } from '../msw/server'

const BASE_URL = 'http://hs.example.com'
const user = { id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' }

function repo() {
  return createUsersRepository(
    createHeadscaleHttp({ getBaseUrl: () => BASE_URL, getApiKey: () => 'test-key' }),
  )
}

describe('UsersRepository writes', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('creates a user with a JSON body', async () => {
    let payload: unknown
    server.use(
      http.post(`${BASE_URL}/api/v1/user`, async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({ user })
      }),
    )
    const created = await repo().create({ name: 'alice', email: 'a@example.com' })
    expect(payload).toEqual({ name: 'alice', email: 'a@example.com' })
    expect(created.name).toBe('alice')
  })

  it('renames a user with encoded path segments', async () => {
    let pathname = ''
    server.use(
      http.post(`${BASE_URL}/api/v1/user/:oldId/rename/:newName`, ({ request }) => {
        pathname = new URL(request.url).pathname
        return HttpResponse.json({ user: { ...user, name: 'bob' } })
      }),
    )
    const renamed = await repo().rename('1', 'bob')
    expect(pathname).toBe('/api/v1/user/1/rename/bob')
    expect(renamed.name).toBe('bob')
  })

  it('deletes a user', async () => {
    let method = ''
    server.use(
      http.delete(`${BASE_URL}/api/v1/user/:id`, ({ request }) => {
        method = request.method
        return HttpResponse.json({})
      }),
    )
    await repo().delete('1')
    expect(method).toBe('DELETE')
  })
})
