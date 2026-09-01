import { describe, expect, it } from 'vitest'
import { deriveBasePathFromModuleUrl } from '@/domain/url'
import { createAppRouter } from '@/router'

describe('deriveBasePathFromModuleUrl', () => {
  it.each([
    ['https://example.com/assets/index.js', '/'],
    ['https://example.com/admin/assets/index.js', '/admin/'],
    ['https://example.com/tools/headscale/assets/index.js', '/tools/headscale/'],
    ['https://example.com/admin/assets/index.js?v=1#entry', '/admin/'],
  ])('derives the application base from %s', (moduleUrl, expected) => {
    expect(deriveBasePathFromModuleUrl(moduleUrl)).toBe(expected)
  })
})

describe('createAppRouter', () => {
  it('uses an injected deployment base', () => {
    const router = createAppRouter('/admin/')
    expect(router.options.history.base).toBe('/admin')
    expect(router.resolve('/register?authId=x').href).toBe('/admin/register?authId=x')
    expect(router.resolve('/auth?authId=x').href).toBe('/admin/auth?authId=x')
  })
})
