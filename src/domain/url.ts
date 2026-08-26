export function normalizeBasePath(value: string): string {
  if (!value.startsWith('/') || !value.endsWith('/')) {
    throw new Error('VITE_BASE_PATH must start and end with /')
  }
  return value
}
