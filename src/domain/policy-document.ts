import {
  applyEdits,
  modify,
  parseTree,
  getNodeValue,
  printParseErrorCode,
  type Node,
  type ParseError,
} from 'jsonc-parser'

export type PolicyPath = (string | number)[]
export type PolicyObject = Record<string, unknown>
export function isObject(value: unknown): value is PolicyObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parsePolicy(text: string): { value?: PolicyObject; error?: string } {
  const errors: ParseError[] = []
  const tree = parseTree(text, errors, { allowTrailingComma: true, disallowComments: false })
  const first = errors[0]
  if (first) {
    const before = text.slice(0, first.offset).split('\n')
    return {
      error: `${printParseErrorCode(first.error)} (${before.length}:${(before.at(-1)?.length ?? 0) + 1})`,
    }
  }
  if (!tree || tree.type !== 'object') return { error: 'ExpectedObject (1:1)' }
  function duplicate(node: Node): boolean {
    if (node.type === 'object') {
      const keys = (node.children ?? []).map((property) => String(property.children?.[0]?.value))
      if (new Set(keys).size !== keys.length) return true
    }
    return (node.children ?? []).some(duplicate)
  }
  if (duplicate(tree)) return { error: 'DuplicateProperty' }
  return { value: getNodeValue(tree) as PolicyObject }
}

export function editPolicy(text: string, path: PolicyPath, value: unknown): string {
  const parsed = parsePolicy(text)
  if (parsed.error) throw new Error(parsed.error)
  const result = applyEdits(
    text,
    modify(text, path, value, { formattingOptions: { insertSpaces: true, tabSize: 2 } }),
  )
  const next = parsePolicy(result)
  if (next.error) throw new Error(next.error)
  return result
}
