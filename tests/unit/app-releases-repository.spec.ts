import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppReleasesRepository } from '@/repositories/app-releases-repository'

const endpoint = 'https://api.github.com/repos/Mystery00/headscale-web/releases/latest'
const release = { tag_name: 'v0.1.4', draft: false, prerelease: false }
const day = 86_400_000

describe('app releases repository', () => {
  beforeEach(() => localStorage.clear())

  it('uses a credential-free GitHub request and shares cached results across instances for 24 hours', async () => {
    let now = 1_800_000_000_000
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(release)))
    const repo = createAppReleasesRepository({
      fetch: fetcher,
      storage: localStorage,
      now: () => now,
    })
    expect((await repo.latest())?.version).toBe('v0.1.4')
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, options] = fetcher.mock.calls[0]!
    expect(url).toBe(endpoint)
    expect(options?.credentials).toBe('omit')
    expect(options?.referrerPolicy).toBe('no-referrer')
    expect(new Headers(options?.headers).has('Authorization')).toBe(false)
    expect(options?.signal).toBeInstanceOf(AbortSignal)
    now += day - 1
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new Error('must use cache'))
    expect(
      (
        await createAppReleasesRepository({
          fetch: offline,
          storage: localStorage,
          now: () => now,
        }).latest()
      )?.version,
    ).toBe('v0.1.4')
    expect(offline).not.toHaveBeenCalled()
    now += 1
    const newer = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ...release, tag_name: 'v0.1.5' })))
    expect(
      (
        await createAppReleasesRepository({
          fetch: newer,
          storage: localStorage,
          now: () => now,
        }).latest()
      )?.version,
    ).toBe('v0.1.5')
    expect(newer).toHaveBeenCalledTimes(1)
  })

  it.each([403, 404, 429, 500])(
    'silently backs off after HTTP %s without repeated requests',
    async (status) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }))
      const repo = createAppReleasesRepository({ fetch: fetcher, storage: localStorage })
      expect(await repo.latest()).toBeNull()
      expect(await repo.latest()).toBeNull()
      expect(fetcher).toHaveBeenCalledTimes(1)
    },
  )

  it('degrades gracefully when offline or browser storage is blocked', async () => {
    const storage = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    } as unknown as Storage
    const failed = createAppReleasesRepository({
      storage,
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')),
    })
    expect(await failed.latest()).toBeNull()
    const available = createAppReleasesRepository({
      storage,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(release))),
    })
    expect((await available.latest())?.version).toBe('v0.1.4')
  })

  it('ignores malformed or future-dated cache data', async () => {
    const now = 1_800_000_000_000
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify(release)))
    localStorage.setItem('hs-web:v1:app-release', '{bad json')
    const repo = createAppReleasesRepository({
      fetch: fetcher,
      storage: localStorage,
      now: () => now,
    })
    expect((await repo.latest())?.version).toBe('v0.1.4')
    localStorage.setItem(
      'hs-web:v1:app-release',
      JSON.stringify({ checkedAt: now + day, release: null }),
    )
    expect((await repo.latest())?.version).toBe('v0.1.4')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('treats malformed JSON and prereleases as unavailable', async () => {
    for (const body of ['not json', JSON.stringify({ ...release, prerelease: true })]) {
      localStorage.clear()
      const repo = createAppReleasesRepository({
        storage: localStorage,
        fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(body)),
      })
      expect(await repo.latest()).toBeNull()
    }
  })

  it('does not cache results after cancellation', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort()
      return new Response(JSON.stringify(release))
    })
    const repo = createAppReleasesRepository({ storage: localStorage, fetch: fetcher })
    await expect(repo.latest(controller.signal)).rejects.toThrow()
    expect(localStorage.getItem('hs-web:v1:app-release')).toBeNull()
  })
})
