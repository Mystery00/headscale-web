import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHeadscaleHttp } from '@/api/http'
import { createPreAuthKeysRepository } from '@/repositories/preauth-keys-repository'
import { server } from '../msw/server'

const BASE_URL = 'http://hs.example.com'

function repo() {
  return createPreAuthKeysRepository(
    createHeadscaleHttp({ getBaseUrl: () => BASE_URL, getApiKey: () => 'test-key' }),
  )
}

describe('PreAuthKeysRepository writes', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('returns plaintext only alongside a preview record', async () => {
    server.use(
      http.post(`${BASE_URL}/api/v1/preauthkey`, async () => {
        return HttpResponse.json({
          preAuthKey: {
            id: '9',
            key: 'hskey-abcdefghijklmnopqrstuvwxyz',
            createdAt: '2024-01-01T00:00:00Z',
            expiration: '2024-12-01T00:00:00Z',
          },
        })
      }),
    )
    const created = await repo().create({
      userId: '1',
      reusable: false,
      ephemeral: false,
      expiration: new Date('2024-12-01T00:00:00Z'),
      aclTags: [],
    })
    expect(created.plaintext).toBe('hskey-abcdefghijklmnopqrstuvwxyz')
    expect(created.record.keyPreview).toBe('hske…wxyz')
    expect(JSON.stringify(created.record)).not.toContain('hskey-abcdefghijklmnopqrstuvwxyz')
  })

  it('expires with { id } and deletes with query id', async () => {
    let expireBody: unknown
    let deleteUrl = ''
    server.use(
      http.post(`${BASE_URL}/api/v1/preauthkey/expire`, async ({ request }) => {
        expireBody = await request.json()
        return HttpResponse.json({})
      }),
      http.delete(`${BASE_URL}/api/v1/preauthkey`, ({ request }) => {
        deleteUrl = request.url
        return HttpResponse.json({})
      }),
    )
    await repo().expire('9')
    await repo().delete('9')
    expect(expireBody).toEqual({ id: '9' })
    expect(new URL(deleteUrl).searchParams.get('id')).toBe('9')
  })
})
