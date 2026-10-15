import { describe, expect, it } from 'vitest'
import { isNewerAppRelease, parseAppRelease } from '@/domain/app-release'

describe('app release versions', () => {
  it.each([
    ['v0.1.3', 'v0.1.4', true],
    ['0.1.9', 'v0.1.10', true],
    ['0.9.0', '1.0.0', true],
    ['v0.1.4', '0.1.4', false],
    ['0.1.5', '0.1.4', false],
    ['0.2.0', '0.1.99', false],
    ['0.1.4-rc.1', '0.1.4', true],
    ['0.1.5-rc.1', '0.1.4', false],
    ['0.1.4+build.1', '0.1.4+build.2', false],
    ['dev', '0.1.4', false],
    ['unknown', '0.1.4', false],
    ['0.1.3', '0.2.0-beta.1', false],
    ['01.1.3', '0.2.0', false],
    ['0.1.3', '999999999999999999999.0.0', false],
  ])('compares %s against %s as %s', (current, latest, expected) => {
    expect(isNewerAppRelease(current, latest)).toBe(expected)
  })

  it('builds a trusted release URL rather than using remote html_url', () => {
    expect(
      parseAppRelease({
        tag_name: 'v0.1.4',
        prerelease: false,
        draft: false,
        html_url: 'https://evil.example',
      }),
    ).toEqual({
      version: 'v0.1.4',
      url: 'https://github.com/Mystery00/headscale-web/releases/tag/v0.1.4',
    })
  })

  it.each([
    null,
    {},
    { tag_name: 'v0.1.4' },
    { tag_name: 'v0.1.4', prerelease: true, draft: false },
    { tag_name: 'v0.1.4', prerelease: false, draft: true },
    { tag_name: 'v0.1.4-rc.1', prerelease: false, draft: false },
    { tag_name: '../other', prerelease: false, draft: false },
  ])('rejects invalid or non-public stable releases: %j', (input) => {
    expect(parseAppRelease(input)).toBeNull()
  })
})
