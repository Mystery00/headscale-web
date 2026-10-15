import { APP_LATEST_RELEASE_URL } from '@/config/app'
import { parseAppRelease, type AppRelease } from '@/domain/app-release'
import { STORAGE_KEYS } from '@/domain/storage-keys'

export const APP_RELEASE_CACHE_MS = 24 * 60 * 60 * 1000

export function createAppReleasesRepository(input?: {
  fetch?: typeof fetch
  storage?: Storage
  now?: () => number
}) {
  const fetchImpl = input?.fetch ?? fetch
  const now = input?.now ?? Date.now
  const storage = () => input?.storage ?? globalThis.localStorage

  function readCache(): { release: AppRelease | null } | null {
    try {
      const raw = storage().getItem(STORAGE_KEYS.appRelease)
      if (!raw) return null
      const cache = JSON.parse(raw)
      if (!cache || typeof cache.checkedAt !== 'number') return null
      const age = now() - cache.checkedAt
      if (!Number.isFinite(age) || age < 0 || age >= APP_RELEASE_CACHE_MS) return null
      if (cache.release === null) return { release: null }
      // Re-validate cached data and derive the URL; never trust a stored link.
      const release = parseAppRelease({
        tag_name: cache.release?.version,
        draft: false,
        prerelease: false,
      })
      return release ? { release } : null
    } catch {
      return null
    }
  }

  return {
    async latest(signal?: AbortSignal): Promise<AppRelease | null> {
      signal?.throwIfAborted()
      const cached = readCache()
      if (cached) return cached.release
      let release: AppRelease | null = null
      try {
        const timeout = AbortSignal.timeout(8_000)
        const response = await fetchImpl(APP_LATEST_RELEASE_URL, {
          method: 'GET',
          headers: { Accept: 'application/vnd.github+json' },
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          redirect: 'error',
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        })
        if (response.ok) release = parseAppRelease(await response.json())
      } catch {
        // Offline, CSP, rate limits and malformed responses are non-blocking.
      }
      signal?.throwIfAborted()
      try {
        // Also back off after failures: no repeated calls on navigation/reloads.
        storage().setItem(STORAGE_KEYS.appRelease, JSON.stringify({ checkedAt: now(), release }))
      } catch {
        // The query cache still deduplicates requests when storage is unavailable.
      }
      return release
    },
  }
}
