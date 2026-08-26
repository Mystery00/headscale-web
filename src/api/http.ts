import { AppApiError, mapHttpFailure } from '@/api/errors'

export interface HeadscaleHttp {
  request(input: {
    path: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    query?: Record<string, string>
    body?: unknown
    authenticated: boolean
  }): Promise<unknown>
}

const DEFAULT_TIMEOUT_MS = 15_000

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  return name === 'TimeoutError' || name === 'AbortError'
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string>): URL {
  const normalized = baseUrl.replace(/\/+$/, '')
  const url = new URL(path, `${normalized}/`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }
  }
  return url
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export function createHeadscaleHttp(input: {
  getBaseUrl: () => string
  getApiKey: () => string | null
  fetch?: typeof fetch
  timeoutMs?: number
}): HeadscaleHttp {
  const fetchImpl = input.fetch ?? fetch
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function send(requestInput: Parameters<HeadscaleHttp['request']>[0]): Promise<unknown> {
    if (requestInput.authenticated && !input.getApiKey()) {
      throw new AppApiError({ kind: 'unauthorized', message: 'API key is missing' })
    }

    const headers = new Headers({ Accept: 'application/json' })
    if (requestInput.authenticated) {
      headers.set('Authorization', `Bearer ${input.getApiKey()}`)
    }
    if (requestInput.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    const url = buildUrl(input.getBaseUrl(), requestInput.path, requestInput.query)
    const signal = AbortSignal.timeout(timeoutMs)

    try {
      const response = await fetchImpl(url, {
        method: requestInput.method,
        headers,
        body: requestInput.body === undefined ? undefined : JSON.stringify(requestInput.body),
        signal,
      })
      const body = await readBody(response)
      if (!response.ok) {
        throw mapHttpFailure({ status: response.status, body })
      }
      return body
    } catch (error) {
      if (error instanceof AppApiError) throw error
      if (isTimeout(error)) {
        throw mapHttpFailure({ timedOut: true, networkError: error })
      }
      throw mapHttpFailure({ networkError: error })
    }
  }

  return {
    async request(requestInput) {
      try {
        return await send(requestInput)
      } catch (error) {
        const retryable =
          requestInput.method === 'GET' && error instanceof AppApiError && error.kind === 'network'
        if (!retryable) throw error
        return send(requestInput)
      }
    },
  }
}
