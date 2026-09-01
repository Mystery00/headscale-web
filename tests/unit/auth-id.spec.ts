import { describe, expect, it } from 'vitest'
import { maskAuthId, parseAuthId } from '@/domain/auth-id'

const valid = 'hskey-authreq-abcdefghijklmnopqrstuvwx'

describe('Auth ID', () => {
  it('accepts the Headscale 0.29 auth request format', () => {
    expect(parseAuthId(valid)).toBe(valid)
  })

  it.each([
    undefined,
    '',
    'hskey-authreq-short',
    'hskey-authreq-abcdefghijklmnopqrstuvw!',
    [valid],
  ])('rejects invalid value %j', (value) => expect(parseAuthId(value)).toBeNull())

  it('masks the capability while retaining a diagnostic suffix', () => {
    expect(maskAuthId(valid)).toBe('hskey-authreq-••••••••••••tuvwx')
  })
})
