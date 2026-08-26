import { defineStore } from 'pinia'
import type { CredentialPersistence } from '@/domain/credentials'
import { STORAGE_KEYS } from '@/domain/storage-keys'

export type ThemePreference = 'light' | 'dark' | 'system'
export type LocaleCode = 'zh-CN' | 'en-US'
export type DateTimeStyle = 'absolute' | 'relative'

export interface AppSettings {
  baseUrl: string | null
  credentialPersistence: CredentialPersistence
  pollingEnabled: boolean
  pollingIntervalMs: number
  locale: LocaleCode
  theme: ThemePreference
  dateTimeStyle: DateTimeStyle
}

export const POLLING_INTERVAL_PRESETS_MS = [5_000, 10_000, 15_000, 30_000, 60_000] as const
export const DEFAULT_POLLING_INTERVAL_MS = 15_000
export const MIN_POLLING_INTERVAL_MS = 5_000

const LOCALES: readonly LocaleCode[] = ['zh-CN', 'en-US']
const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system']
const DATE_STYLES: readonly DateTimeStyle[] = ['absolute', 'relative']
const PERSISTENCE: readonly CredentialPersistence[] = ['session', 'local']

function isLocale(value: unknown): value is LocaleCode {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

function isTheme(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

function detectLocale(): LocaleCode {
  const language = globalThis.navigator?.language ?? 'en-US'
  return language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

function clampInterval(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_POLLING_INTERVAL_MS
  }
  return Math.max(MIN_POLLING_INTERVAL_MS, Math.round(value))
}

function defaultSettings(): AppSettings {
  return {
    baseUrl: null,
    credentialPersistence: 'session',
    pollingEnabled: true,
    pollingIntervalMs: DEFAULT_POLLING_INTERVAL_MS,
    locale: detectLocale(),
    theme: 'system',
    dateTimeStyle: 'absolute',
  }
}

function readJson(raw: string | null): Partial<AppSettings> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Partial<AppSettings>) : {}
  } catch {
    return {}
  }
}

function loadSettings(): AppSettings {
  const defaults = defaultSettings()
  const stored = readJson(localStorage.getItem(STORAGE_KEYS.settings))
  const localeFromKey = localStorage.getItem(STORAGE_KEYS.locale)
  const themeFromKey = localStorage.getItem(STORAGE_KEYS.theme)

  return {
    baseUrl: typeof stored.baseUrl === 'string' ? stored.baseUrl : null,
    credentialPersistence: PERSISTENCE.includes(
      stored.credentialPersistence as CredentialPersistence,
    )
      ? (stored.credentialPersistence as CredentialPersistence)
      : defaults.credentialPersistence,
    pollingEnabled:
      typeof stored.pollingEnabled === 'boolean' ? stored.pollingEnabled : defaults.pollingEnabled,
    pollingIntervalMs: clampInterval(stored.pollingIntervalMs),
    locale: isLocale(localeFromKey)
      ? localeFromKey
      : isLocale(stored.locale)
        ? stored.locale
        : localStorage.getItem(STORAGE_KEYS.settings)
          ? 'en-US'
          : defaults.locale,
    theme: isTheme(themeFromKey)
      ? themeFromKey
      : isTheme(stored.theme)
        ? stored.theme
        : defaults.theme,
    dateTimeStyle: DATE_STYLES.includes(stored.dateTimeStyle as DateTimeStyle)
      ? (stored.dateTimeStyle as DateTimeStyle)
      : defaults.dateTimeStyle,
  }
}

function persist(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings))
  localStorage.setItem(STORAGE_KEYS.locale, settings.locale)
  localStorage.setItem(STORAGE_KEYS.theme, settings.theme)
}

export const useSettingsStore = defineStore('settings', {
  state: (): AppSettings => loadSettings(),
  actions: {
    update(patch: Partial<AppSettings>) {
      if (patch.baseUrl !== undefined) this.baseUrl = patch.baseUrl
      if (patch.credentialPersistence !== undefined)
        this.credentialPersistence = patch.credentialPersistence
      if (patch.pollingEnabled !== undefined) this.pollingEnabled = patch.pollingEnabled
      if (patch.pollingIntervalMs !== undefined)
        this.pollingIntervalMs = clampInterval(patch.pollingIntervalMs)
      if (patch.locale !== undefined && isLocale(patch.locale)) this.locale = patch.locale
      if (patch.theme !== undefined && isTheme(patch.theme)) this.theme = patch.theme
      if (patch.dateTimeStyle !== undefined) this.dateTimeStyle = patch.dateTimeStyle
      persist(this.$state)
    },
  },
})
