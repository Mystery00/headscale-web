export function normalizeTags(input: string[]): string[] {
  const result: string[] = []
  for (const raw of input) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const value = trimmed.startsWith('tag:') ? trimmed : `tag:${trimmed}`
    const body = value.slice('tag:'.length)
    if (!body || /\s/.test(body)) {
      throw new Error('tag value must not contain whitespace')
    }
    if (!result.includes(value)) result.push(value)
  }
  return result
}
