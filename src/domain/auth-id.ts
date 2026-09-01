const AUTH_ID_PREFIX = 'hskey-authreq-'
const AUTH_ID_PATTERN = /^hskey-authreq-[A-Za-z0-9_-]{24}$/

export function parseAuthId(value: unknown): string | null {
  return typeof value === 'string' && AUTH_ID_PATTERN.test(value) ? value : null
}

export function maskAuthId(authId: string): string {
  return `${AUTH_ID_PREFIX}${'•'.repeat(12)}${authId.slice(-5)}`
}
