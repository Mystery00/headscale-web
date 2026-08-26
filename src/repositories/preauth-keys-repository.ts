import type { components } from '@/api/generated/headscale'
import type { HeadscaleHttp } from '@/api/http'
import type { PreAuthKey } from '@/domain/preauth-key'
import { mapPreAuthKey } from '@/mappers/preauth-key-mapper'

export interface PreAuthKeysRepository {
  list(): Promise<PreAuthKey[]>
}

export function createPreAuthKeysRepository(http: HeadscaleHttp): PreAuthKeysRepository {
  return {
    async list() {
      const body = (await http.request({
        path: '/api/v1/preauthkey',
        method: 'GET',
        authenticated: true,
      })) as components['schemas']['v1ListPreAuthKeysResponse'] | undefined
      return (body?.preAuthKeys ?? []).map((key) => mapPreAuthKey(key))
    },
  }
}
