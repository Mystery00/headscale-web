import { describe, expect, it } from 'vitest'
import { getApiErrorMessage, mapHttpFailure } from '@/api/errors'

describe('getApiErrorMessage', () => {
  it('提取结构化错误原因，不展示整个响应或内部异常', () => {
    expect(
      getApiErrorMessage(
        mapHttpFailure({
          status: 400,
          body: { message: '  invalid tags  ', details: ['private'] },
        }),
      ),
    ).toBe('invalid tags')
    expect(getApiErrorMessage(new Error('internal secret'))).toBeUndefined()
  })

  it.each([undefined, { message: 42 }, { message: '  ' }, '<html>proxy error</html>'])(
    '没有有效服务端消息时回退到 HTTP 状态',
    (body) => {
      expect(getApiErrorMessage(mapHttpFailure({ status: 502, body }))).toBe('HTTP 502')
    },
  )

  it('限制错误消息长度', () => {
    expect(
      getApiErrorMessage(mapHttpFailure({ status: 400, body: { message: 'x'.repeat(1000) } }))
        ?.length,
    ).toBeLessThanOrEqual(500)
  })
})

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
