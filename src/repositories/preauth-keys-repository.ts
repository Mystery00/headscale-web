import type { components } from '@/api/generated/headscale'
import type { HeadscaleHttp } from '@/api/http'
import type { PreAuthKey } from '@/domain/preauth-key'
import type { CreatedPreAuthKey, CreatePreAuthKeyInput } from '@/domain/preauth-key-writes'
import { mapPreAuthKey } from '@/mappers/preauth-key-mapper'

export interface PreAuthKeysRepository {
  list(): Promise<PreAuthKey[]>
  create(input: CreatePreAuthKeyInput): Promise<CreatedPreAuthKey>
  expire(id: string): Promise<void>
  delete(id: string): Promise<void>
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
    async create(input) {
      const body = (await http.request({
        path: '/api/v1/preauthkey',
        method: 'POST',
        body: {
          user: input.userId,
          reusable: input.reusable,
          ephemeral: input.ephemeral,
          expiration: input.expiration?.toISOString(),
          aclTags: input.aclTags,
        },
        authenticated: true,
      })) as components['schemas']['v1CreatePreAuthKeyResponse'] | undefined
      if (!body?.preAuthKey?.key) throw new Error('missing preauth key')
      const plaintext = body.preAuthKey.key
      return {
        record: mapPreAuthKey(body.preAuthKey),
        plaintext,
      }
    },
    async expire(id) {
      await http.request({
        path: '/api/v1/preauthkey/expire',
        method: 'POST',
        body: { id },
        authenticated: true,
      })
    },
    async delete(id) {
      await http.request({
        path: '/api/v1/preauthkey',
        method: 'DELETE',
        query: { id },
        authenticated: true,
      })
    },
  }
}
