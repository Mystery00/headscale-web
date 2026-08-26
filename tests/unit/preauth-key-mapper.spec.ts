import { describe, expect, it } from 'vitest'
import { mapPreAuthKey, previewKey } from '@/mappers/preauth-key-mapper'

describe('previewKey', () => {
  it('keeps the first and last four characters', () => {
    expect(previewKey('hskey-abcdefghijklmnopqrstuvwxyz')).toBe('hske…wxyz')
  })

  it('returns null for an empty key', () => {
    expect(previewKey(undefined)).toBeNull()
    expect(previewKey('')).toBeNull()
  })
})

describe('mapPreAuthKey', () => {
  const now = new Date('2024-06-01T00:00:00Z')

  it('marks used keys as used', () => {
    const key = mapPreAuthKey(
      {
        id: '3',
        key: 'hskey-abcdefghijklmnopqrstuvwxyz',
        used: true,
        createdAt: '2024-01-01T00:00:00Z',
        expiration: '2024-12-01T00:00:00Z',
      },
      now,
    )
    expect(key.state).toBe('used')
    expect(key.keyPreview).toBe('hske…wxyz')
    expect(key).not.toHaveProperty('key')
  })

  it('marks past expiration as expired', () => {
    const key = mapPreAuthKey(
      {
        id: '3',
        used: false,
        createdAt: '2024-01-01T00:00:00Z',
        expiration: '2024-05-01T00:00:00Z',
      },
      now,
    )
    expect(key.state).toBe('expired')
  })

  it('marks unused future keys as active', () => {
    const key = mapPreAuthKey(
      {
        id: '3',
        used: false,
        createdAt: '2024-01-01T00:00:00Z',
        expiration: '2024-12-01T00:00:00Z',
      },
      now,
    )
    expect(key.state).toBe('active')
  })
})
