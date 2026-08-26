import type { components } from '@/api/generated/headscale'
import type { HeadscaleHttp } from '@/api/http'
import type { Node } from '@/domain/node'
import { mapNode } from '@/mappers/node-mapper'

export interface NodesRepository {
  list(filters?: { userName?: string }): Promise<Node[]>
  get(nodeId: string): Promise<Node>
  rename(nodeId: string, newName: string): Promise<Node>
  expireNow(nodeId: string): Promise<Node>
  setExpiry(nodeId: string, expiry: Date): Promise<Node>
  disableExpiry(nodeId: string): Promise<Node>
  setTags(nodeId: string, tags: string[]): Promise<Node>
  setApprovedRoutes(nodeId: string, routes: string[]): Promise<Node>
  delete(nodeId: string): Promise<void>
}

function nodePath(nodeId: string, suffix = '') {
  return `/api/v1/node/${encodeURIComponent(nodeId)}${suffix}`
}

async function readNode(
  http: HeadscaleHttp,
  path: string,
  extra?: { body?: unknown },
): Promise<Node> {
  const body = (await http.request({
    path,
    method: 'POST',
    body: extra?.body,
    authenticated: true,
  })) as { node?: components['schemas']['v1Node'] } | undefined
  if (!body?.node) throw new Error('missing node')
  return mapNode(body.node)
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
        path: nodePath(nodeId),
        method: 'GET',
        authenticated: true,
      })) as components['schemas']['v1GetNodeResponse'] | undefined
      if (!body?.node) throw new Error('missing node')
      return mapNode(body.node)
    },
    rename(nodeId, newName) {
      return readNode(http, `${nodePath(nodeId)}/rename/${encodeURIComponent(newName)}`)
    },
    expireNow(nodeId) {
      return readNode(http, `${nodePath(nodeId)}/expire`, { body: {} })
    },
    setExpiry(nodeId, expiry) {
      return readNode(http, `${nodePath(nodeId)}/expire`, { body: { expiry: expiry.toISOString() } })
    },
    disableExpiry(nodeId) {
      return readNode(http, `${nodePath(nodeId)}/expire`, { body: { disableExpiry: true } })
    },
    setTags(nodeId, tags) {
      return readNode(http, `${nodePath(nodeId)}/tags`, { body: { tags } })
    },
    setApprovedRoutes(nodeId, routes) {
      return readNode(http, `${nodePath(nodeId)}/approve_routes`, { body: { routes } })
    },
    async delete(nodeId) {
      await http.request({
        path: nodePath(nodeId),
        method: 'DELETE',
        authenticated: true,
      })
    },
  }
}
