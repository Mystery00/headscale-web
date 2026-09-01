import { createHeadscaleHttp } from '@/api/http'
import { createApiKeysRepository } from '@/repositories/api-keys-repository'
import { createAuthRepository } from '@/repositories/auth-repository'
import { createNodesRepository } from '@/repositories/nodes-repository'
import { createPreAuthKeysRepository } from '@/repositories/preauth-keys-repository'
import { createSystemRepository } from '@/repositories/system-repository'
import { createUsersRepository } from '@/repositories/users-repository'
import { credentialStore } from '@/stores/credentials'
import { useSettingsStore } from '@/stores/settings'

export function createAppRepositories() {
  const http = createHeadscaleHttp({
    getBaseUrl: () => useSettingsStore().baseUrl ?? '',
    getApiKey: () => credentialStore.getApiKey(),
  })
  return {
    system: createSystemRepository(http),
    apiKeys: createApiKeysRepository(http),
    auth: createAuthRepository(http),
    users: createUsersRepository(http),
    nodes: createNodesRepository(http),
    preAuthKeys: createPreAuthKeysRepository(http),
  }
}
