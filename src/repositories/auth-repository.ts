import type { components } from '@/api/generated/headscale'
import type { HeadscaleHttp } from '@/api/http'
import type { Node } from '@/domain/node'
import { mapNode } from '@/mappers/node-mapper'

export interface AuthRepository {
  register(input: { authId: string; userName: string }): Promise<Node>
  approve(authId: string): Promise<void>
  reject(authId: string): Promise<void>
}

export function createAuthRepository(http: HeadscaleHttp): AuthRepository {
  return {
    async register(input) {
      const body = (await http.request({
        path: '/api/v1/auth/register',
        method: 'POST',
        body: { authId: input.authId, user: input.userName },
        authenticated: true,
      })) as components['schemas']['v1AuthRegisterResponse'] | undefined
      if (!body?.node) throw new Error('missing node')
      return mapNode(body.node)
    },
    async approve(authId) {
      await http.request({
        path: '/api/v1/auth/approve',
        method: 'POST',
        body: { authId },
        authenticated: true,
      })
    },
    async reject(authId) {
      await http.request({
        path: '/api/v1/auth/reject',
        method: 'POST',
        body: { authId },
        authenticated: true,
      })
    },
  }
}
