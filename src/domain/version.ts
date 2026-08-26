export function isSupportedHeadscaleVersion(version: string): boolean {
  const match = version.trim().match(/^v?(\d+)\.(\d+)(?:\.(\d+))?(?:[-+].*)?$/i)
  if (!match) return false

  const major = Number(match[1])
  const minor = Number(match[2])
  return major === 0 && minor === 29
}
