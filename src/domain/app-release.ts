import { APP_REPOSITORY_URL } from '@/config/app'

export interface AppRelease {
  version: string
  url: string
}

export function parseAppVersion(value: string): { parts: number[]; prerelease: boolean } | null {
  const match = value.match(
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  )
  if (!match) return null
  const parts = match.slice(1, 4).map(Number)
  if (!parts.every(Number.isSafeInteger)) return null
  if (match[4]?.split('.').some((part) => /^0\d+$/.test(part))) return null
  return { parts, prerelease: Boolean(match[4]) }
}

export function isNewerAppRelease(current: string, latest: string): boolean {
  const installed = parseAppVersion(current)
  const available = parseAppVersion(latest)
  if (!installed || !available || available.prerelease) return false
  for (let i = 0; i < 3; i++) {
    if (available.parts[i] !== installed.parts[i]) {
      return available.parts[i]! > installed.parts[i]!
    }
  }
  return installed.prerelease
}

export function parseAppRelease(input: unknown): AppRelease | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  if (
    record.draft !== false ||
    record.prerelease !== false ||
    typeof record.tag_name !== 'string'
  ) {
    return null
  }
  const version = parseAppVersion(record.tag_name)
  if (!version || version.prerelease) return null
  return {
    version: record.tag_name,
    url: `${APP_REPOSITORY_URL}/releases/tag/${encodeURIComponent(record.tag_name)}`,
  }
}
