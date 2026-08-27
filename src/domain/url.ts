export function deriveBasePathFromModuleUrl(moduleUrl: string): string {
  return new URL('../', moduleUrl).pathname
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
