import { describe, expect, it } from 'vitest'
import { mapUser } from '@/mappers/user-mapper'

describe('mapUser', () => {
  it('maps a complete user and keeps the id as a string', () => {
    const user = mapUser({
      id: '9007199254740993',
      name: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      provider: 'oidc',
      providerId: 'sub-1',
      profilePicUrl: 'https://example.com/a.png',
      createdAt: '2024-01-02T03:04:05Z',
    })

    expect(user).toEqual({
      id: '9007199254740993',
      name: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      provider: 'oidc',
      providerId: 'sub-1',
      profilePictureUrl: 'https://example.com/a.png',
      createdAt: new Date('2024-01-02T03:04:05Z'),
    })
  })

  it('throws when id is missing', () => {
    expect(() => mapUser({ name: 'alice', createdAt: '2024-01-02T03:04:05Z' })).toThrow(
      'missing id',
    )
  })
})
