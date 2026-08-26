import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '@/domain/storage-keys'
import { useSettingsStore } from '@/stores/settings'

describe('useSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts with safe defaults', () => {
    const store = useSettingsStore()
    expect(store.baseUrl).toBeNull()
    expect(store.credentialPersistence).toBe('session')
    expect(store.pollingEnabled).toBe(true)
    expect(store.pollingIntervalMs).toBe(15_000)
    expect(store.theme).toBe('system')
    expect(store.dateTimeStyle).toBe('absolute')
    expect(['zh-CN', 'en-US']).toContain(store.locale)
  })

  it('persists and restores settings', () => {
    const first = useSettingsStore()
    first.update({
      baseUrl: 'https://hs.example.com',
      credentialPersistence: 'local',
      pollingEnabled: false,
      pollingIntervalMs: 30_000,
      locale: 'zh-CN',
      theme: 'dark',
      dateTimeStyle: 'relative',
    })

    setActivePinia(createPinia())
    const second = useSettingsStore()
    expect(second.baseUrl).toBe('https://hs.example.com')
    expect(second.credentialPersistence).toBe('local')
    expect(second.pollingEnabled).toBe(false)
    expect(second.pollingIntervalMs).toBe(30_000)
    expect(second.locale).toBe('zh-CN')
    expect(second.theme).toBe('dark')
    expect(second.dateTimeStyle).toBe('relative')
    expect(localStorage.getItem(STORAGE_KEYS.locale)).toBe('zh-CN')
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark')
  })

  it('clamps polling interval to the minimum', () => {
    const store = useSettingsStore()
    store.update({ pollingIntervalMs: 1_000 })
    expect(store.pollingIntervalMs).toBe(5_000)
  })

  it('falls back when stored locale and theme are unknown', () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        baseUrl: null,
        credentialPersistence: 'session',
        pollingEnabled: true,
        pollingIntervalMs: 15_000,
        locale: 'fr-FR',
        theme: 'neon',
        dateTimeStyle: 'absolute',
      }),
    )
    localStorage.setItem(STORAGE_KEYS.locale, 'nope')
    localStorage.setItem(STORAGE_KEYS.theme, 'neon')

    const store = useSettingsStore()
    expect(store.locale).toBe('en-US')
    expect(store.theme).toBe('system')
  })
})
