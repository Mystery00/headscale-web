export function normalizeBasePath(value: string): string {
  if (!value.startsWith('/') || !value.endsWith('/')) {
    throw new Error('VITE_BASE_PATH must start and end with /')
  }
  return value
}

export type HeadscaleUrlError =
  'empty' | 'invalid' | 'unsupported-protocol' | 'credentials-not-allowed'

export type HeadscaleUrlResult =
  { ok: true; url: string } | { ok: false; reason: HeadscaleUrlError }

export function normalizeHeadscaleUrl(input: string): HeadscaleUrlResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported-protocol' }
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'credentials-not-allowed' }
  }

  const url = parsed.href.replace(/\/+$/, '')
  return { ok: true, url }
}
