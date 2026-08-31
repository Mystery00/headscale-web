import type { components } from '@/api/generated/headscale'
import type { HeadscaleHttp } from '@/api/http'
import type { ApiKeyMetadata } from '@/domain/api-key-status'
import { parseApiKeyPrefix } from '@/domain/api-key-status'

export interface ApiKeysRepository {
  current(fullKey: string): Promise<ApiKeyMetadata | null>
}

function optionalDate(value: string | undefined): Date | null {
  return value ? new Date(value) : null
}

export function createApiKeysRepository(http: HeadscaleHttp): ApiKeysRepository {
  return {
    async current(fullKey) {
      const parsed = parseApiKeyPrefix(fullKey)
      if (!parsed) return null
      const body = (await http.request({
        path: '/api/v1/apikey',
        method: 'GET',
        authenticated: true,
      })) as components['schemas']['v1ListApiKeysResponse'] | undefined
      const match = (body?.apiKeys ?? []).find((key) => key.prefix === parsed.displayPrefix)
      if (!match) return null
      return {
        id: match.id ?? '',
        ...parsed,
        expiration: optionalDate(match.expiration),
        createdAt: optionalDate(match.createdAt),
        lastSeen: optionalDate(match.lastSeen),
      }
    },
  }
}
