import type { CredentialPersistence, CredentialStore } from '@/domain/credentials'
import { STORAGE_KEYS } from '@/domain/storage-keys'

export function createCredentialStore(input?: {
  sessionStorage?: Storage
  localStorage?: Storage
}): CredentialStore {
  const sessionStorage = input?.sessionStorage ?? globalThis.sessionStorage
  const localStorage = input?.localStorage ?? globalThis.localStorage
  let apiKey: string | null = null

  function write(key: string, persistence: CredentialPersistence) {
    if (persistence === 'session') {
      sessionStorage.setItem(STORAGE_KEYS.apiKeySession, key)
      localStorage.removeItem(STORAGE_KEYS.apiKeyLocal)
      return
    }
    localStorage.setItem(STORAGE_KEYS.apiKeyLocal, key)
    sessionStorage.removeItem(STORAGE_KEYS.apiKeySession)
  }

  return {
    hydrate() {
      apiKey =
        sessionStorage.getItem(STORAGE_KEYS.apiKeySession) ??
        localStorage.getItem(STORAGE_KEYS.apiKeyLocal)
    },
    getApiKey() {
      return apiKey
    },
    setApiKey(key: string, persistence: CredentialPersistence) {
      const trimmed = key.trim()
      if (!trimmed) {
        throw new Error('API key must not be empty')
      }
      apiKey = trimmed
      write(trimmed, persistence)
    },
    clear() {
      apiKey = null
      sessionStorage.removeItem(STORAGE_KEYS.apiKeySession)
      localStorage.removeItem(STORAGE_KEYS.apiKeyLocal)
    },
  }
}

export const credentialStore = createCredentialStore()
