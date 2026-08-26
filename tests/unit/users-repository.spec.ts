import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHeadscaleHttp } from '@/api/http'
import { createUsersRepository } from '@/repositories/users-repository'
import { server } from '../msw/server'

const BASE_URL = 'http://hs.example.com'

function repo() {
  return createUsersRepository(
    createHeadscaleHttp({
      getBaseUrl: () => BASE_URL,
      getApiKey: () => 'test-key',
    }),
  )
}

describe('UsersRepository', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('lists users with optional filters and Authorization', async () => {
    let requestUrl = ''
    let authorization = ''
    server.use(
      http.get(`${BASE_URL}/api/v1/user`, ({ request }) => {
        requestUrl = request.url
        authorization = request.headers.get('Authorization') ?? ''
        return HttpResponse.json({
          users: [{ id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' }],
        })
      }),
    )

    const users = await repo().list({ name: 'alice' })
    expect(authorization).toBe('Bearer test-key')
    expect(new URL(requestUrl).searchParams.get('name')).toBe('alice')
    expect(users[0]?.id).toBe('1')
    expect(users[0]?.name).toBe('alice')
  })
})
