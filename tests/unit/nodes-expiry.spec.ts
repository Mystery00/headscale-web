import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHeadscaleHttp } from '@/api/http'
import { createNodesRepository, type NodesRepository } from '@/repositories/nodes-repository'
import { server } from '../msw/server'

const BASE_URL = 'http://hs.example.com'
const NOW = '2026-10-24T11:00:00.000Z'
const expiry = new Date('2030-01-02T03:04:05.678+05:30')
const node = {
  id: '18446744073709551615',
  user: { id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' },
  createdAt: '2024-01-02T03:04:05Z',
}

describe('NodesRepository expiry transport', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it.each<{
    name: string
    run: (repository: NodesRepository) => ReturnType<NodesRepository['setExpiry']>
    query: Record<string, string>
    body: string
    expiry: Date | null
  }>([
    {
      name: 'sets an expiry through the query string',
      run: (repository) => repository.setExpiry(node.id, expiry),
      query: { expiry: expiry.toISOString() },
      body: '',
      expiry,
    },
    {
      name: 'disables expiry through the query string',
      run: (repository) => repository.disableExpiry(node.id),
      query: { disableExpiry: 'true' },
      body: '',
      expiry: null,
    },
    {
      name: 'expires immediately without either expiry query parameter',
      run: (repository) => repository.expireNow(node.id),
      query: {},
      body: '{}',
      expiry: new Date(NOW),
    },
  ])('$name', async (testCase) => {
    let receivedQuery: Record<string, string> | undefined
    let receivedBody: string | undefined
    let receivedAuthorization: string | null | undefined
    server.use(
      http.post(`${BASE_URL}/api/v1/node/:id/expire`, async ({ request, params }) => {
        const query = new URL(request.url).searchParams
        receivedQuery = Object.fromEntries(query)
        receivedBody = await request.text()
        receivedAuthorization = request.headers.get('Authorization')
        // Headscale 0.29.x's gateway discards the body and only reads query parameters.
        const expiry = query.get('disableExpiry') === 'true' ? null : (query.get('expiry') ?? NOW)
        return HttpResponse.json({ node: { ...node, id: params.id, expiry } })
      }),
    )
    const repository = createNodesRepository(
      createHeadscaleHttp({ getBaseUrl: () => BASE_URL, getApiKey: () => 'test-key' }),
    )

    const result = await testCase.run(repository)

    expect(result.expiry).toEqual(testCase.expiry)
    expect(result.id).toBe(node.id)
    expect(receivedQuery).toEqual(testCase.query)
    expect(receivedBody).toBe(testCase.body)
    expect(receivedAuthorization).toBe('Bearer test-key')
  })
})
