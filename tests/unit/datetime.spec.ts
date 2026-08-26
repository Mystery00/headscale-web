import { describe, expect, it } from 'vitest'
import { formatDateTime } from '@/domain/datetime'

describe('formatDateTime', () => {
  it('returns a dash for null', () => {
    expect(formatDateTime(null, { locale: 'en-US', style: 'absolute' })).toBe('—')
  })

  it('formats an absolute English timestamp', () => {
    const text = formatDateTime(new Date('2024-01-02T03:04:00Z'), {
      locale: 'en-US',
      style: 'absolute',
    })
    expect(text).toMatch(/2024/)
  })

  it('formats a relative timestamp', () => {
    const text = formatDateTime(new Date(Date.now() - 60_000), {
      locale: 'en-US',
      style: 'relative',
    })
    expect(text.toLowerCase()).toMatch(/ago|minute/)
  })
})
