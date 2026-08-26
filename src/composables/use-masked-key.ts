import { previewKey } from '@/mappers/preauth-key-mapper'

export function useMaskedKey() {
  return {
    mask(value: string | undefined) {
      return previewKey(value) ?? '—'
    },
  }
}
