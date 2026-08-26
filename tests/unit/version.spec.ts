import { describe, expect, it } from 'vitest'
import { isSupportedHeadscaleVersion } from '@/domain/version'

describe('isSupportedHeadscaleVersion', () => {
  it.each(['0.29.0', '0.29.3', 'v0.29.3', '0.29'])('accepts %s', (value) => {
    expect(isSupportedHeadscaleVersion(value)).toBe(true)
  })

  it.each(['0.28.0', '0.30.0', '1.0.0', '', 'unknown'])('rejects %s', (value) => {
    expect(isSupportedHeadscaleVersion(value)).toBe(false)
  })
})
