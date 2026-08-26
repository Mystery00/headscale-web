import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHeadscaleHttp } from '@/api/http'
import { createNodesRepository } from '@/repositories/nodes-repository'
import { server } from '../msw/server'

const BASE_URL = 'http://hs.example.com'
const user = { id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' }
const node = { id: '42', name: 'laptop', user, createdAt: '2024-01-02T03:04:05Z' }

function repo() {
  return createNodesRepository(
    createHeadscaleHttp({ getBaseUrl: () => BASE_URL, getApiKey: () => 'test-key' }),
  )
}

describe('NodesRepository writes', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('expires immediately with an empty JSON object', async () => {
    let payload: unknown
    server.use(
      http.post(`${BASE_URL}/api/v1/node/:id/expire`, async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({ node })
      }),
    )
    await repo().expireNow('42')
    expect(payload).toEqual({})
  })

  it('sends the full approved routes collection', async () => {
    let payload: unknown
    server.use(
      http.post(`${BASE_URL}/api/v1/node/:id/approve_routes`, async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({ node })
      }),
    )
    await repo().setApprovedRoutes('42', ['10.0.0.0/8', '0.0.0.0/0', '::/0'])
    expect(payload).toEqual({ routes: ['10.0.0.0/8', '0.0.0.0/0', '::/0'] })
  })

  it('sets tags with a tags array', async () => {
    let payload: unknown
    server.use(
      http.post(`${BASE_URL}/api/v1/node/:id/tags`, async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({ node })
      }),
    )
    await repo().setTags('42', ['tag:lab'])
    expect(payload).toEqual({ tags: ['tag:lab'] })
  })
})
