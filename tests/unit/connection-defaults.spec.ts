import { describe, expect, it } from 'vitest'
import { initialHeadscaleUrl } from '@/domain/connection-defaults'

describe('initialHeadscaleUrl', () => {
  it('prefers a saved Headscale URL over the page origin', () => {
    expect(initialHeadscaleUrl('https://saved.example.com', 'https://page.example.com')).toBe(
      'https://saved.example.com',
    )
  })

  it('uses the page origin when no Headscale URL is saved', () => {
    expect(initialHeadscaleUrl(null, 'https://page.example.com')).toBe('https://page.example.com')
  })
})
