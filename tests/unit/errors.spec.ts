import { describe, expect, it } from 'vitest'
import { mapHttpFailure } from '@/api/errors'

describe('mapHttpFailure', () => {
  it('maps 401 to unauthorized', () => {
    const error = mapHttpFailure({ status: 401, body: { code: 16, message: 'unauthenticated' } })
    expect(error.kind).toBe('unauthorized')
    expect(error.status).toBe(401)
    expect(error.details).toEqual({ code: 16, message: 'unauthenticated' })
  })

  it('maps 404/409/400/5xx', () => {
    expect(mapHttpFailure({ status: 404 }).kind).toBe('not-found')
    expect(mapHttpFailure({ status: 409 }).kind).toBe('conflict')
    expect(mapHttpFailure({ status: 400 }).kind).toBe('validation')
    expect(mapHttpFailure({ status: 500 }).kind).toBe('server')
  })

  it('maps timeout, cors, and network', () => {
    expect(mapHttpFailure({ timedOut: true }).kind).toBe('timeout')
    expect(mapHttpFailure({ cors: true }).kind).toBe('cors')
    expect(mapHttpFailure({ networkError: new TypeError('Failed to fetch') }).kind).toBe('network')
  })
})
