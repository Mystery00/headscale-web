import { formatDistanceToNow, type Locale } from 'date-fns'
import { enUS, ko, zhCN } from 'date-fns/locale'
import type { DateTimeStyle, LocaleCode } from '@/stores/settings'

const DATE_FNS_LOCALES: Record<LocaleCode, Locale> = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'ko-KR': ko,
}

export function formatDateTime(
  value: Date | null,
  options: { locale: LocaleCode; style: DateTimeStyle },
): string {
  if (!value) return '—'
  if (options.style === 'relative') {
    return formatDistanceToNow(value, {
      addSuffix: true,
      locale: DATE_FNS_LOCALES[options.locale],
    })
  }
  return new Intl.DateTimeFormat(options.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}
