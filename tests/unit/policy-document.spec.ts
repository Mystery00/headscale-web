import { describe, expect, it } from 'vitest'
import { editPolicy, parsePolicy } from '@/domain/policy-document'

describe('policy document', () => {
  it('preserves other comments, unknown fields, and trailing commas when editing a nested field', () => {
    const original =
      '{\n // keep\n "grants": [{"src":["*"], /* extra */ "future":42,"dst":["tag:a"],}],"randomizeClientPort":false,\n}'
    const result = editPolicy(original, ['grants', 0, 'dst'], ['tag:b'])
    expect(result).toContain('// keep')
    expect(result).toContain('/* extra */')
    expect(parsePolicy(result).value).toEqual({
      grants: [{ src: ['*'], future: 42, dst: ['tag:b'] }],
      randomizeClientPort: false,
    })
  })
  it('keeps undefined, empty rules, and false distinct', () => {
    expect(parsePolicy(editPolicy('{}', ['tagOwners', 'tag:lab'], [])).value).toEqual({
      tagOwners: { 'tag:lab': [] },
    })
    const empty = editPolicy('{}', ['grants'], [])
    expect(parsePolicy(empty).value).toEqual({ grants: [] })
    expect(parsePolicy(editPolicy(empty, ['grants'], undefined)).value).toEqual({})
  })
  it.each(['[]', 'null', '{"x":1,"x":2}', '{"grants":[{"src":[],"src":[]}]}', '{bad}', ''])(
    'rejects ambiguous or invalid document %s',
    (text) => {
      expect(parsePolicy(text).error).toBeTruthy()
      expect(() => editPolicy(text, ['grants'], [])).toThrow()
    },
  )
  it('keeps a valid document after removing a middle array item without affecting unknown root fields', () => {
    const result = editPolicy(
      '{"grants":[{"src":["a"]},{"src":["b"]},{"src":["c"]}],"future":true}',
      ['grants', 1],
      undefined,
    )
    expect(parsePolicy(result).value).toEqual({
      grants: [{ src: ['a'] }, { src: ['c'] }],
      future: true,
    })
  })
})
