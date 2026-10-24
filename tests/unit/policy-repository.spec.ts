import { describe, expect, it } from 'vitest'
import { createHeadscaleHttp } from '@/api/http'
import { createPolicyRepository } from '@/repositories/policy-repository'

describe('策略接口合同', () => {
  it('保持 HuJSON 原文，校验与保存使用不同端点且携带认证', async () => {
    const calls: { url: string; method: string; body: unknown; auth: string | null }[] = []
    const repo = createPolicyRepository(
      createHeadscaleHttp({
        getBaseUrl: () => 'http://mock.invalid',
        getApiKey: () => 'test',
        fetch: async (url, init) => {
          calls.push({
            url: String(url),
            method: init!.method!,
            body: init!.body ? JSON.parse(String(init!.body)) : undefined,
            auth: new Headers(init!.headers).get('Authorization'),
          })
          return new Response(
            JSON.stringify({ policy: '{/*original*/}', updatedAt: '2026-10-24T00:00:00Z' }),
          )
        },
      }),
    )
    expect(await repo.get()).toEqual({
      policy: '{/*original*/}',
      updatedAt: '2026-10-24T00:00:00Z',
    })
    await repo.check('{/*draft*/}')
    await repo.set('{/*draft*/}')
    expect(calls).toEqual([
      {
        url: 'http://mock.invalid/api/v1/policy',
        method: 'GET',
        body: undefined,
        auth: 'Bearer test',
      },
      {
        url: 'http://mock.invalid/api/v1/policy/check',
        method: 'POST',
        body: { policy: '{/*draft*/}' },
        auth: 'Bearer test',
      },
      {
        url: 'http://mock.invalid/api/v1/policy',
        method: 'PUT',
        body: { policy: '{/*draft*/}' },
        auth: 'Bearer test',
      },
    ])
  })
  it('加载响应缺失策略时抛错而不是使用空策略', async () => {
    const repo = createPolicyRepository({ request: async () => ({}) })
    await expect(repo.get()).rejects.toThrow()
  })
})
