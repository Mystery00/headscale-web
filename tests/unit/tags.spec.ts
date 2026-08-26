import { describe, expect, it } from 'vitest'
import { normalizeTags } from '@/domain/tags'

describe('normalizeTags', () => {
  it('prefixes tag: and drops blanks and duplicates', () => {
    expect(normalizeTags([' lab ', 'tag:lab', '', 'prod'])).toEqual(['tag:lab', 'tag:prod'])
  })

  it('rejects values that contain whitespace after trim', () => {
    expect(() => normalizeTags(['tag:has space'])).toThrow(/whitespace/)
  })
})
