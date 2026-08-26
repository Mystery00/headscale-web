import { createHeadscaleHttp } from '@/api/http'
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
    users: createUsersRepository(http),
    nodes: createNodesRepository(http),
    preAuthKeys: createPreAuthKeysRepository(http),
  }
}
