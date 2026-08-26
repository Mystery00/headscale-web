import type { components } from '@/api/generated/headscale'
import type { User } from '@/domain/user'

export function requireId(id: string | undefined): string {
  if (!id) throw new Error('missing id')
  return id
}

export function parseRequiredDate(value: string | undefined): Date {
  if (!value) throw new Error('missing createdAt')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('missing createdAt')
  return date
}

export function parseOptionalDate(value: string | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function mapUser(dto: components['schemas']['v1User']): User {
  return {
    id: requireId(dto.id),
    name: dto.name ?? '',
    displayName: dto.displayName ?? '',
    email: dto.email ?? '',
    provider: dto.provider ?? '',
    providerId: dto.providerId ?? '',
    profilePictureUrl: dto.profilePicUrl ?? '',
    createdAt: parseRequiredDate(dto.createdAt),
  }
}
