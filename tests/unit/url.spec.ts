import { describe, expect, it } from 'vitest'
import { normalizeHeadscaleUrl } from '@/domain/url'

describe('normalizeHeadscaleUrl', () => {
  it('trims and strips a trailing slash', () => {
    expect(normalizeHeadscaleUrl(' https://hs.example.com/ ')).toEqual({
      ok: true,
      url: 'https://hs.example.com',
    })
  })

  it('keeps http and https', () => {
    expect(normalizeHeadscaleUrl('http://127.0.0.1:8080')).toEqual({
      ok: true,
      url: 'http://127.0.0.1:8080',
    })
  })

  it('rejects empty input', () => {
    expect(normalizeHeadscaleUrl('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects non-http protocols', () => {
    expect(normalizeHeadscaleUrl('ftp://hs.example.com')).toEqual({
      ok: false,
      reason: 'unsupported-protocol',
    })
  })

  it('rejects embedded credentials', () => {
    expect(normalizeHeadscaleUrl('https://user:pass@hs.example.com')).toEqual({
      ok: false,
      reason: 'credentials-not-allowed',
    })
  })

  it('rejects unparseable values', () => {
    expect(normalizeHeadscaleUrl('not a url')).toEqual({ ok: false, reason: 'invalid' })
  })
})
