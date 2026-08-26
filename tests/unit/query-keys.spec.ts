import { describe, expect, it } from 'vitest'
import { queryKeys } from '@/query/keys'

describe('queryKeys', () => {
  it('keeps the spec key shapes', () => {
    expect(queryKeys.systemVersion).toEqual(['system', 'version'])
    expect(queryKeys.systemHealth).toEqual(['system', 'health'])
    expect(queryKeys.users({ name: 'alice' })).toEqual(['users', { name: 'alice' }])
    expect(queryKeys.users()).toEqual(['users', {}])
    expect(queryKeys.nodes({ userName: 'alice' })).toEqual(['nodes', { userName: 'alice' }])
    expect(queryKeys.node('42')).toEqual(['node', '42'])
    expect(queryKeys.preAuthKeys).toEqual(['preAuthKeys'])
  })
})
