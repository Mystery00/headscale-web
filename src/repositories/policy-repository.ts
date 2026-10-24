import type { HeadscaleHttp } from '@/api/http'
import type { components } from '@/api/generated/headscale'

export interface PolicySnapshot {
  policy: string
  updatedAt?: string
}
export interface PolicyRepository {
  get(): Promise<PolicySnapshot>
  check(policy: string): Promise<void>
  set(policy: string): Promise<void>
}
export function createPolicyRepository(http: HeadscaleHttp): PolicyRepository {
  return {
    async get() {
      const body = (await http.request({
        path: '/api/v1/policy',
        method: 'GET',
        authenticated: true,
      })) as components['schemas']['v1GetPolicyResponse'] | undefined
      if (typeof body?.policy !== 'string')
        throw new Error('Policy response is missing policy text')
      return { policy: body.policy, updatedAt: body.updatedAt }
    },
    async check(policy) {
      await http.request({
        path: '/api/v1/policy/check',
        method: 'POST',
        body: { policy },
        authenticated: true,
      })
    },
    async set(policy) {
      await http.request({
        path: '/api/v1/policy',
        method: 'PUT',
        body: { policy },
        authenticated: true,
      })
    },
  }
}
