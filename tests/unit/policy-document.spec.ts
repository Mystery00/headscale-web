import { describe, expect, it } from 'vitest'
import { editPolicy, parsePolicy } from '@/domain/policy-document'

describe('策略文本', () => {
  it('修改嵌套字段时保留其他注释、未知字段和尾逗号', () => {
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
  it('保留未定义、空规则和 false 的区别', () => {
    expect(parsePolicy(editPolicy('{}', ['tagOwners', 'tag:lab'], [])).value).toEqual({
      tagOwners: { 'tag:lab': [] },
    })
    const empty = editPolicy('{}', ['grants'], [])
    expect(parsePolicy(empty).value).toEqual({ grants: [] })
    expect(parsePolicy(editPolicy(empty, ['grants'], undefined)).value).toEqual({})
  })
  it.each(['[]', 'null', '{"x":1,"x":2}', '{"grants":[{"src":[],"src":[]}]}', '{bad}', ''])(
    '拒绝歧义或无效文档 %s',
    (text) => {
      expect(parsePolicy(text).error).toBeTruthy()
      expect(() => editPolicy(text, ['grants'], [])).toThrow()
    },
  )
  it('删除中间数组项后仍有合法文档且不影响未知根字段', () => {
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
