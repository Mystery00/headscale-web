import { describe, expect, it } from 'vitest'
import { safeInternalRedirect } from '@/domain/internal-redirect'

describe('safeInternalRedirect', () => {
  it.each([
    ['/register?authId=abc', '/register?authId=abc'],
    ['/auth?authId=abc#result', '/auth?authId=abc#result'],
    ['/nodes?userId=1', '/nodes?userId=1'],
  ])('keeps internal target %s', (value, expected) => {
    expect(safeInternalRedirect(value)).toBe(expected)
  })

  it.each([
    'https://evil.example/register',
    '//evil.example/register',
    '/\\evil.example/register',
    'javascript:alert(1)',
    '',
    undefined,
  ])('rejects external or malformed target %j', (value) =>
    expect(safeInternalRedirect(value)).toBe('/'),
  )
})
