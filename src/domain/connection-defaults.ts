export function initialHeadscaleUrl(savedBaseUrl: string | null, origin: string): string {
  return savedBaseUrl ?? origin
}
