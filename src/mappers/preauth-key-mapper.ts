import type { components } from '@/api/generated/headscale'
import type { PreAuthKey, PreAuthKeyState, PreAuthKeySummary } from '@/domain/preauth-key'
import { mapUser, parseOptionalDate, parseRequiredDate, requireId } from '@/mappers/user-mapper'

export function previewKey(key: string | undefined): string | null {
  if (!key) return null
  if (key.length <= 8) return key
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

export function preAuthKeyState(
  input: { used: boolean; expiration: Date | null },
  now: Date,
): PreAuthKeyState {
  if (input.used) return 'used'
  if (input.expiration && input.expiration.getTime() <= now.getTime()) return 'expired'
  return 'active'
}

export function mapPreAuthKeySummary(
  dto: components['schemas']['v1PreAuthKey'] | undefined,
): PreAuthKeySummary | null {
  if (!dto?.id) return null
  return { id: dto.id, keyPreview: previewKey(dto.key) }
}

export function mapPreAuthKey(
  dto: components['schemas']['v1PreAuthKey'],
  now: Date = new Date(),
): PreAuthKey {
  const expiration = parseOptionalDate(dto.expiration)
  const used = Boolean(dto.used)
  return {
    id: requireId(dto.id),
    user: dto.user?.id ? mapUser(dto.user) : null,
    keyPreview: previewKey(dto.key),
    reusable: Boolean(dto.reusable),
    ephemeral: Boolean(dto.ephemeral),
    used,
    expiration,
    createdAt: parseRequiredDate(dto.createdAt),
    aclTags: dto.aclTags ?? [],
    state: preAuthKeyState({ used, expiration }, now),
  }
}
