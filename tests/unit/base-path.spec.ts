import { describe, expect, it } from 'vitest'
import { normalizeBasePath } from '@/domain/url'

describe('normalizeBasePath', () => {
  it('accepts / and /admin/', () => {
    expect(normalizeBasePath('/')).toBe('/')
    expect(normalizeBasePath('/admin/')).toBe('/admin/')
  })

  it('rejects missing slashes', () => {
    expect(() => normalizeBasePath('admin')).toThrow(/start and end with \//)
    expect(() => normalizeBasePath('/admin')).toThrow(/start and end with \//)
  })
})
