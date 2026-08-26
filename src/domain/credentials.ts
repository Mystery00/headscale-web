export type CredentialPersistence = 'session' | 'local'

export interface CredentialStore {
  hydrate(): void
  getApiKey(): string | null
  setApiKey(key: string, persistence: CredentialPersistence): void
  clear(): void
}
