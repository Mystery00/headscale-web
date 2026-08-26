import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHeadscaleHttp } from '@/api/http'
import { createNodesRepository } from '@/repositories/nodes-repository'
import { server } from '../msw/server'

const BASE_URL = 'http://hs.example.com'
const user = { id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' }

function repo() {
  return createNodesRepository(
    createHeadscaleHttp({
      getBaseUrl: () => BASE_URL,
      getApiKey: () => 'test-key',
    }),
  )
}

describe('NodesRepository', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('lists nodes with the user query parameter', async () => {
    let requestUrl = ''
    server.use(
      http.get(`${BASE_URL}/api/v1/node`, ({ request }) => {
        requestUrl = request.url
        return HttpResponse.json({
          nodes: [{ id: '42', name: 'laptop', user, createdAt: '2024-01-02T03:04:05Z', tags: ['tag:lab'] }],
        })
      }),
    )

    const nodes = await repo().list({ userName: 'alice' })
    expect(new URL(requestUrl).searchParams.get('user')).toBe('alice')
    expect(nodes[0]?.id).toBe('42')
    expect(nodes[0]?.tags).toEqual(['tag:lab'])
  })

  it('gets a node by encoded id', async () => {
    server.use(
      http.get(`${BASE_URL}/api/v1/node/:nodeId`, ({ params }) => {
        return HttpResponse.json({
          node: { id: String(params.nodeId), user, createdAt: '2024-01-02T03:04:05Z' },
        })
      }),
    )

    const node = await repo().get('42')
    expect(node.id).toBe('42')
  })
})
