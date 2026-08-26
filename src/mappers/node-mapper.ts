import type { components } from '@/api/generated/headscale'
import type { Node } from '@/domain/node'
import type { RegisterMethod } from '@/domain/register-method'
import { mapPreAuthKeySummary } from '@/mappers/preauth-key-mapper'
import { mapUser, parseOptionalDate, parseRequiredDate, requireId } from '@/mappers/user-mapper'

export function mapRegisterMethod(
  value: components['schemas']['v1RegisterMethod'] | undefined,
): RegisterMethod {
  if (value === 'REGISTER_METHOD_AUTH_KEY') return 'auth-key'
  if (value === 'REGISTER_METHOD_CLI') return 'cli'
  if (value === 'REGISTER_METHOD_OIDC') return 'oidc'
  return 'unspecified'
}

export function mapNode(dto: components['schemas']['v1Node']): Node {
  if (!dto.user) throw new Error('missing user')
  return {
    id: requireId(dto.id),
    name: dto.name ?? '',
    givenName: dto.givenName ?? '',
    machineKey: dto.machineKey ?? '',
    nodeKey: dto.nodeKey ?? '',
    discoKey: dto.discoKey ?? '',
    ipAddresses: dto.ipAddresses ?? [],
    user: mapUser(dto.user),
    lastSeen: parseOptionalDate(dto.lastSeen),
    expiry: parseOptionalDate(dto.expiry),
    createdAt: parseRequiredDate(dto.createdAt),
    registerMethod: mapRegisterMethod(dto.registerMethod),
    online: Boolean(dto.online),
    tags: dto.tags ?? [],
    approvedRoutes: dto.approvedRoutes ?? [],
    availableRoutes: dto.availableRoutes ?? [],
    subnetRoutes: dto.subnetRoutes ?? [],
    preAuthKey: mapPreAuthKeySummary(dto.preAuthKey),
  }
}
