import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHeadscaleHttp } from '@/api/http'
import { createApiKeysRepository } from '@/repositories/api-keys-repository'
import { server } from '../msw/server'

const BASE_URL = 'http://hs.example.com'
const FULL_KEY = `hskey-api-ABCDEFGHIJKL-${'x'.repeat(64)}`

function repo() {
  return createApiKeysRepository(
    createHeadscaleHttp({ getBaseUrl: () => BASE_URL, getApiKey: () => FULL_KEY }),
  )
}

describe('ApiKeysRepository', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('finds the current key with one authenticated list request', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE_URL}/api/v1/apikey`, ({ request }) => {
        calls += 1
        expect(request.headers.get('authorization')).toBe(`Bearer ${FULL_KEY}`)
        return HttpResponse.json({
          apiKeys: [
            { id: '1', prefix: 'hskey-api-ZZZZZZZZZZZZ-***' },
            {
              id: '2',
              prefix: 'hskey-api-ABCDEFGHIJKL-***',
              expiration: '2026-10-01T00:00:00Z',
              createdAt: '2026-07-01T00:00:00Z',
              lastSeen: '2026-08-30T00:00:00Z',
            },
          ],
        })
      }),
    )

    const result = await repo().current(FULL_KEY)
    expect(calls).toBe(1)
    expect(result).toEqual({
      id: '2',
      displayPrefix: 'hskey-api-ABCDEFGHIJKL-***',
      rawPrefix: 'ABCDEFGHIJKL',
      expiration: new Date('2026-10-01T00:00:00Z'),
      createdAt: new Date('2026-07-01T00:00:00Z'),
      lastSeen: new Date('2026-08-30T00:00:00Z'),
    })
  })

  it('returns null for a malformed or unmatched current key', async () => {
    expect(await repo().current('not-a-headscale-key')).toBeNull()
    server.use(http.get(`${BASE_URL}/api/v1/apikey`, () => HttpResponse.json({ apiKeys: [] })))
    expect(await repo().current(FULL_KEY)).toBeNull()
  })
})
