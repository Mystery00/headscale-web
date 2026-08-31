import { describe, expect, it } from 'vitest'
import { apiKeyExpirationState, parseApiKeyPrefix } from '@/domain/api-key-status'

describe('parseApiKeyPrefix', () => {
  it('parses a current-format key without retaining its secret', () => {
    const secret = 'x'.repeat(64)
    const result = parseApiKeyPrefix(`hskey-api-ABCDEFGHIJKL-${secret}`)
    expect(result).toEqual({
      rawPrefix: 'ABCDEFGHIJKL',
      displayPrefix: 'hskey-api-ABCDEFGHIJKL-***',
    })
    expect(JSON.stringify(result)).not.toContain(secret)
  })

  it('parses a legacy key without retaining its secret', () => {
    expect(parseApiKeyPrefix('abcdefg.legacy-secret')).toEqual({
      rawPrefix: 'abcdefg',
      displayPrefix: 'abcdefg***',
    })
  })

  it('rejects malformed keys', () => {
    expect(parseApiKeyPrefix('test-key')).toBeNull()
    expect(parseApiKeyPrefix('hskey-api-short-secret')).toBeNull()
  })
})

describe('apiKeyExpirationState', () => {
  const now = new Date('2026-08-31T00:00:00Z')

  it('classifies keys with no expiration', () => {
    expect(apiKeyExpirationState(null, now)).toBe('no-expiration')
  })

  it('classifies expired keys', () => {
    expect(apiKeyExpirationState(new Date('2026-08-30T23:59:59Z'), now)).toBe('expired')
  })

  it('treats exactly 30 days as expiring soon', () => {
    expect(apiKeyExpirationState(new Date('2026-09-30T00:00:00Z'), now)).toBe('expiring-soon')
  })

  it('classifies more than 30 days as healthy', () => {
    expect(apiKeyExpirationState(new Date('2026-09-30T00:00:00.001Z'), now)).toBe('healthy')
  })
})
