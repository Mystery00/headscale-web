import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHeadscaleHttp } from '@/api/http'
import { createPreAuthKeysRepository } from '@/repositories/preauth-keys-repository'
import { server } from '../msw/server'

const BASE_URL = 'http://hs.example.com'

function repo() {
  return createPreAuthKeysRepository(
    createHeadscaleHttp({
      getBaseUrl: () => BASE_URL,
      getApiKey: () => 'test-key',
    }),
  )
}

describe('PreAuthKeysRepository', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('lists preauth keys with a single request and drops the full key', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE_URL}/api/v1/preauthkey`, () => {
        calls += 1
        return HttpResponse.json({
          preAuthKeys: [
            {
              id: '9',
              key: 'hskey-abcdefghijklmnopqrstuvwxyz',
              used: false,
              createdAt: '2024-01-01T00:00:00Z',
              expiration: '2024-12-01T00:00:00Z',
            },
          ],
        })
      }),
    )

    const keys = await repo().list()
    expect(calls).toBe(1)
    expect(keys).toHaveLength(1)
    expect(keys[0]?.id).toBe('9')
    expect(keys[0]?.keyPreview).toBe('hske…wxyz')
    expect(JSON.stringify(keys)).not.toContain('hskey-abcdefghijklmnopqrstuvwxyz')
  })
})
