import type { components } from '@/api/generated/headscale'
import type { HeadscaleHttp } from '@/api/http'
import type { User } from '@/domain/user'
import type { CreateUserInput } from '@/domain/user-writes'
import { mapUser } from '@/mappers/user-mapper'

export interface UsersRepository {
  list(filters?: { id?: string; name?: string; email?: string }): Promise<User[]>
  create(input: CreateUserInput): Promise<User>
  rename(userId: string, newName: string): Promise<User>
  delete(userId: string): Promise<void>
}

function compactQuery(input?: Record<string, string | undefined>): Record<string, string> | undefined {
  if (!input) return undefined
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value) query[key] = value
  }
  return Object.keys(query).length ? query : undefined
}

export function createUsersRepository(http: HeadscaleHttp): UsersRepository {
  return {
    async list(filters) {
      const body = (await http.request({
        path: '/api/v1/user',
        method: 'GET',
        query: compactQuery(filters),
        authenticated: true,
      })) as components['schemas']['v1ListUsersResponse'] | undefined
      return (body?.users ?? []).map(mapUser)
    },
    async create(input) {
      const body = (await http.request({
        path: '/api/v1/user',
        method: 'POST',
        body: {
          name: input.name,
          displayName: input.displayName,
          email: input.email,
          pictureUrl: input.pictureUrl,
        },
        authenticated: true,
      })) as components['schemas']['v1CreateUserResponse'] | undefined
      if (!body?.user) throw new Error('missing user')
      return mapUser(body.user)
    },
    async rename(userId, newName) {
      const body = (await http.request({
        path: `/api/v1/user/${encodeURIComponent(userId)}/rename/${encodeURIComponent(newName)}`,
        method: 'POST',
        authenticated: true,
      })) as components['schemas']['v1RenameUserResponse'] | undefined
      if (!body?.user) throw new Error('missing user')
      return mapUser(body.user)
    },
    async delete(userId) {
      await http.request({
        path: `/api/v1/user/${encodeURIComponent(userId)}`,
        method: 'DELETE',
        authenticated: true,
      })
    },
  }
}
