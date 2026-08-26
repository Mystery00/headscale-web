import type { components } from '@/api/generated/headscale'
import type { HeadscaleHttp } from '@/api/http'
import type { User } from '@/domain/user'
import { mapUser } from '@/mappers/user-mapper'

export interface UsersRepository {
  list(filters?: { id?: string; name?: string; email?: string }): Promise<User[]>
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
  }
}
