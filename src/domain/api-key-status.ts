const CURRENT_KEY = /^hskey-api-([A-Za-z0-9_-]{12})-([A-Za-z0-9_-]{64})$/
const LEGACY_KEY = /^([^\s.]{7})\.(\S+)$/
const EXPIRING_SOON_MS = 30 * 24 * 60 * 60 * 1000

export interface ApiKeyPrefix {
  rawPrefix: string
  displayPrefix: string
}

export interface ApiKeyMetadata extends ApiKeyPrefix {
  id: string
  expiration: Date | null
  createdAt: Date | null
  lastSeen: Date | null
}

export type ApiKeyExpirationState = 'healthy' | 'expiring-soon' | 'expired' | 'no-expiration'

export function parseApiKeyPrefix(key: string): ApiKeyPrefix | null {
  const current = CURRENT_KEY.exec(key)
  if (current?.[1]) {
    return {
      rawPrefix: current[1],
      displayPrefix: `hskey-api-${current[1]}-***`,
    }
  }

  const legacy = LEGACY_KEY.exec(key)
  if (legacy?.[1]) {
    return { rawPrefix: legacy[1], displayPrefix: `${legacy[1]}***` }
  }

  return null
}

export function apiKeyExpirationState(expiration: Date | null, now: Date): ApiKeyExpirationState {
  if (!expiration) return 'no-expiration'
  if (expiration.getTime() < now.getTime()) return 'expired'
  if (expiration.getTime() <= now.getTime() + EXPIRING_SOON_MS) return 'expiring-soon'
  return 'healthy'
}
