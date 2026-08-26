import { formatDistanceToNow } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import type { DateTimeStyle, LocaleCode } from '@/stores/settings'

export function formatDateTime(
  value: Date | null,
  options: { locale: LocaleCode; style: DateTimeStyle },
): string {
  if (!value) return '—'
  const locale = options.locale === 'zh-CN' ? zhCN : enUS
  if (options.style === 'relative') {
    return formatDistanceToNow(value, { addSuffix: true, locale })
  }
  return new Intl.DateTimeFormat(options.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}
