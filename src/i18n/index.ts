import { createI18n } from 'vue-i18n'
import type { LocaleCode } from '@/stores/settings'
import { enUS } from './locales/en-US'
import { zhCN } from './locales/zh-CN'

export const messages = {
  'en-US': enUS,
  'zh-CN': zhCN,
} as const

export function createAppI18n(locale: LocaleCode) {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en-US',
    messages,
  })
}
