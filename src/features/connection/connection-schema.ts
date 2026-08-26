import { z } from 'zod'
import { normalizeHeadscaleUrl } from '@/domain/url'
import type { CredentialPersistence } from '@/domain/credentials'

export const connectionSchema = z.object({
  baseUrl: z.string(),
  apiKey: z.string().trim().min(1),
  persistence: z.enum(['session', 'local']),
})

export function parseConnectionForm(input: {
  baseUrl: string
  apiKey: string
  persistence: CredentialPersistence
}):
  | { ok: true; value: { baseUrl: string; apiKey: string; persistence: CredentialPersistence } }
  | {
      ok: false
      reason: 'empty' | 'invalid' | 'unsupported-protocol' | 'credentials-not-allowed' | 'empty-key'
    } {
  const parsed = connectionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, reason: 'empty-key' }
  }
  const url = normalizeHeadscaleUrl(parsed.data.baseUrl)
  if (!url.ok) return url
  return {
    ok: true,
    value: {
      baseUrl: url.url,
      apiKey: parsed.data.apiKey,
      persistence: parsed.data.persistence,
    },
  }
}
