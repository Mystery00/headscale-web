import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { AppApiError } from '@/api/errors'
import { createHeadscaleHttp } from '@/api/http'
import { createSystemRepository } from '@/repositories/system-repository'
import { server } from '../msw/server'

const API_KEY = 'test-key'
const BASE_URL = 'http://hs.example.com'

function createRepo() {
  const httpClient = createHeadscaleHttp({
    getBaseUrl: () => BASE_URL,
    getApiKey: () => API_KEY,
    timeoutMs: 80,
  })
  return { httpClient, repo: createSystemRepository(httpClient) }
}

describe('system repository', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })
  afterEach(() => {
    server.resetHandlers()
  })
  afterAll(() => {
    server.close()
  })

  it('validates connection in version, health, user order', async () => {
    const calls: string[] = []
    server.use(
      http.get(`${BASE_URL}/version`, () => {
        calls.push('version')
        return HttpResponse.json({ version: '0.29.3', commit: 'abc' })
      }),
      http.get(`${BASE_URL}/api/v1/health`, () => {
        calls.push('health')
        return HttpResponse.json({ databaseConnectivity: true })
      }),
      http.get(`${BASE_URL}/api/v1/user`, () => {
        calls.push('user')
        return HttpResponse.json({ users: [] })
      }),
    )

    const { repo } = createRepo()
    const status = await repo.validateConnection()

    expect(calls).toEqual(['version', 'health', 'user'])
    expect(status.version).toBe('0.29.3')
    expect(status.commit).toBe('abc')
    expect(status.databaseConnectivity).toBe(true)
    expect(status.apiReachable).toBe(true)
    expect(status.checkedAt).toBeInstanceOf(Date)
  })

  it('preserves an omitted database connectivity field as unavailable', async () => {
    server.use(http.get(`${BASE_URL}/api/v1/health`, () => HttpResponse.json({})))
    const { repo } = createRepo()
    await expect(repo.getHealth()).resolves.toEqual({ databaseConnectivity: undefined })
  })

  it('preserves an explicit disconnected database state', async () => {
    server.use(
      http.get(`${BASE_URL}/api/v1/health`, () =>
        HttpResponse.json({ databaseConnectivity: false }),
      ),
    )
    const { repo } = createRepo()
    await expect(repo.getHealth()).resolves.toEqual({ databaseConnectivity: false })
  })

  it('does not call health or user for unsupported versions', async () => {
    const laterCalls: string[] = []
    server.use(
      http.get(`${BASE_URL}/version`, () => {
        return HttpResponse.json({ version: '0.28.0' })
      }),
      http.get(`${BASE_URL}/api/v1/health`, () => {
        laterCalls.push('health')
        return HttpResponse.json({ databaseConnectivity: true })
      }),
      http.get(`${BASE_URL}/api/v1/user`, () => {
        laterCalls.push('user')
        return HttpResponse.json({ users: [] })
      }),
    )

    const { repo } = createRepo()
    await expect(repo.validateConnection()).rejects.toMatchObject({
      kind: 'unsupported-version',
    })
    expect(laterCalls).toEqual([])
  })

  it('maps 401 on user to unauthorized', async () => {
    server.use(
      http.get(`${BASE_URL}/api/v1/user`, () => {
        return HttpResponse.json({ code: 16, message: 'unauthenticated' }, { status: 401 })
      }),
    )

    const { repo } = createRepo()
    await expect(repo.validateConnection()).rejects.toMatchObject({
      kind: 'unauthorized',
      status: 401,
    })
  })

  it('omits Authorization on /version and sends Bearer on API calls', async () => {
    const headers: Record<string, string | null> = {}
    server.use(
      http.get(`${BASE_URL}/version`, ({ request }) => {
        headers.version = request.headers.get('Authorization')
        return HttpResponse.json({ version: '0.29.3' })
      }),
      http.get(`${BASE_URL}/api/v1/health`, ({ request }) => {
        headers.health = request.headers.get('Authorization')
        return HttpResponse.json({ databaseConnectivity: true })
      }),
      http.get(`${BASE_URL}/api/v1/user`, ({ request }) => {
        headers.user = request.headers.get('Authorization')
        return HttpResponse.json({ users: [] })
      }),
    )

    const { repo } = createRepo()
    await repo.validateConnection()

    expect(headers.version).toBeNull()
    expect(headers.health).toBe('Bearer test-key')
    expect(headers.user).toBe('Bearer test-key')
  })

  it('maps timeouts', async () => {
    server.use(
      http.get(`${BASE_URL}/version`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200))
        return HttpResponse.json({ version: '0.29.3' })
      }),
    )

    const { repo } = createRepo()
    await expect(repo.validateConnection()).rejects.toMatchObject({ kind: 'timeout' })
  })

  it('retries a GET network error once', async () => {
    let attempts = 0
    server.use(
      http.get(`${BASE_URL}/version`, () => {
        attempts += 1
        if (attempts === 1) return HttpResponse.error()
        return HttpResponse.json({ version: '0.29.3', commit: 'abc' })
      }),
    )

    const { repo } = createRepo()
    await expect(repo.getVersion()).resolves.toEqual({ version: '0.29.3', commit: 'abc' })
    expect(attempts).toBe(2)
  })

  it('does not retry a failed POST', async () => {
    let attempts = 0
    server.use(
      http.post(`${BASE_URL}/api/v1/user`, () => {
        attempts += 1
        return HttpResponse.error()
      }),
    )

    const { httpClient } = createRepo()
    await expect(
      httpClient.request({
        path: '/api/v1/user',
        method: 'POST',
        body: { name: 'demo' },
        authenticated: true,
      }),
    ).rejects.toBeInstanceOf(AppApiError)
    expect(attempts).toBe(1)
  })

  it('does not put the API key on thrown errors', async () => {
    server.use(
      http.get(`${BASE_URL}/api/v1/user`, () => {
        return HttpResponse.json({ code: 16, message: 'unauthenticated' }, { status: 401 })
      }),
    )

    const { repo } = createRepo()
    try {
      await repo.validateConnection()
      throw new Error('expected failure')
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(API_KEY)
      expect(String(error)).not.toContain(API_KEY)
    }
  })
})
