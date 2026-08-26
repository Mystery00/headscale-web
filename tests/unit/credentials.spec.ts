import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '@/domain/storage-keys'
import { createCredentialStore } from '@/stores/credentials'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null
    },
    key(index: number) {
      return [...data.keys()][index] ?? null
    },
    removeItem(key: string) {
      data.delete(key)
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
  }
}

describe('createCredentialStore', () => {
  it('hydrates from session storage', () => {
    const sessionStorage = memoryStorage()
    sessionStorage.setItem(STORAGE_KEYS.apiKeySession, 'session-key')
    const store = createCredentialStore({ sessionStorage, localStorage: memoryStorage() })

    store.hydrate()

    expect(store.getApiKey()).toBe('session-key')
  })

  it('hydrates from local storage when session is empty', () => {
    const localStorage = memoryStorage()
    localStorage.setItem(STORAGE_KEYS.apiKeyLocal, 'local-key')
    const store = createCredentialStore({ sessionStorage: memoryStorage(), localStorage })

    store.hydrate()

    expect(store.getApiKey()).toBe('local-key')
  })

  it('prefers session when both storages have keys', () => {
    const sessionStorage = memoryStorage()
    const localStorage = memoryStorage()
    sessionStorage.setItem(STORAGE_KEYS.apiKeySession, 'session-key')
    localStorage.setItem(STORAGE_KEYS.apiKeyLocal, 'local-key')
    const store = createCredentialStore({ sessionStorage, localStorage })

    store.hydrate()

    expect(store.getApiKey()).toBe('session-key')
  })

  it('moves the key when persistence changes', () => {
    const sessionStorage = memoryStorage()
    const localStorage = memoryStorage()
    const store = createCredentialStore({ sessionStorage, localStorage })

    store.setApiKey('moved-key', 'session')
    store.setApiKey('moved-key', 'local')

    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.apiKeyLocal)).toBe('moved-key')
    expect(store.getApiKey()).toBe('moved-key')
  })

  it('clears memory and both storages', () => {
    const sessionStorage = memoryStorage()
    const localStorage = memoryStorage()
    const store = createCredentialStore({ sessionStorage, localStorage })
    store.setApiKey('session-key', 'session')
    localStorage.setItem(STORAGE_KEYS.apiKeyLocal, 'stale-local')

    store.clear()

    expect(store.getApiKey()).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.apiKeyLocal)).toBeNull()
  })

  it('reads from memory after setApiKey without consulting storage', () => {
    const sessionStorage = memoryStorage()
    const store = createCredentialStore({ sessionStorage, localStorage: memoryStorage() })
    store.setApiKey('memory-key', 'session')
    sessionStorage.setItem(STORAGE_KEYS.apiKeySession, 'tampered')

    expect(store.getApiKey()).toBe('memory-key')
  })

  it('stores the raw key string', () => {
    const sessionStorage = memoryStorage()
    const store = createCredentialStore({ sessionStorage, localStorage: memoryStorage() })

    store.setApiKey('plain-key', 'session')

    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBe('plain-key')
  })

  it('rejects an empty key', () => {
    const store = createCredentialStore({
      sessionStorage: memoryStorage(),
      localStorage: memoryStorage(),
    })

    expect(() => store.setApiKey('   ', 'session')).toThrow('API key must not be empty')
  })
})
