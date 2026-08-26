import type { NavigationGuardWithThis } from 'vue-router'
import { credentialStore } from '@/stores/credentials'
import { useSettingsStore } from '@/stores/settings'

export const requireConnection: NavigationGuardWithThis<undefined> = (to) => {
  if (to.path === '/connect') return true
  credentialStore.hydrate()
  const settings = useSettingsStore()
  if (!credentialStore.getApiKey() || !settings.baseUrl) {
    return '/connect'
  }
  return true
}
