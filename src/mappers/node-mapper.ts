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

// ListNodes substitutes this synthetic user for tagged nodes in Headscale 0.29.x.
export const TAGGED_DEVICES_USER_ID = '2147455555'

// The Swagger schema omits the null emitted by detail and mutation responses.
type NodeDto = Omit<components['schemas']['v1Node'], 'user'> & {
  user?: components['schemas']['v1User'] | null
}

export function mapNode(dto: NodeDto): Node {
  const tags = dto.tags ?? []
  const user =
    dto.user && !(tags.length && dto.user.id === TAGGED_DEVICES_USER_ID) ? mapUser(dto.user) : null
  if (!user && !tags.length) throw new Error('missing user')
  return {
    id: requireId(dto.id),
    name: dto.name ?? '',
    givenName: dto.givenName ?? '',
    machineKey: dto.machineKey ?? '',
    nodeKey: dto.nodeKey ?? '',
    discoKey: dto.discoKey ?? '',
    ipAddresses: dto.ipAddresses ?? [],
    user,
    lastSeen: parseOptionalDate(dto.lastSeen),
    expiry: parseOptionalDate(dto.expiry),
    createdAt: parseRequiredDate(dto.createdAt),
    registerMethod: mapRegisterMethod(dto.registerMethod),
    online: Boolean(dto.online),
    tags,
    approvedRoutes: dto.approvedRoutes ?? [],
    availableRoutes: dto.availableRoutes ?? [],
    subnetRoutes: dto.subnetRoutes ?? [],
    preAuthKey: mapPreAuthKeySummary(dto.preAuthKey),
  }
}
