import type { components } from '@/api/generated/headscale'
import type { HeadscaleHttp } from '@/api/http'
import type { Node } from '@/domain/node'
import { mapNode } from '@/mappers/node-mapper'

export interface NodesRepository {
  list(filters?: { userName?: string }): Promise<Node[]>
  get(nodeId: string): Promise<Node>
}

export function createNodesRepository(http: HeadscaleHttp): NodesRepository {
  return {
    async list(filters) {
      const query = filters?.userName ? { user: filters.userName } : undefined
      const body = (await http.request({
        path: '/api/v1/node',
        method: 'GET',
        query,
        authenticated: true,
      })) as components['schemas']['v1ListNodesResponse'] | undefined
      return (body?.nodes ?? []).map(mapNode)
    },
    async get(nodeId) {
      const body = (await http.request({
        path: `/api/v1/node/${encodeURIComponent(nodeId)}`,
        method: 'GET',
        authenticated: true,
      })) as components['schemas']['v1GetNodeResponse'] | undefined
      if (!body?.node) throw new Error('missing node')
      return mapNode(body.node)
    },
  }
}
