export interface PolicyFieldSchema {
  kind: 'string' | 'list' | 'boolean' | 'object' | 'map' | 'array' | 'json'
  fields?: Record<string, PolicyFieldSchema>
  item?: PolicyFieldSchema
  options?: string[]
  placeholder?: string
}
const text = (placeholder = ''): PolicyFieldSchema => ({ kind: 'string', placeholder })
const list = (placeholder = '*'): PolicyFieldSchema => ({ kind: 'list', placeholder })
const object = (fields: Record<string, PolicyFieldSchema>): PolicyFieldSchema => ({
  kind: 'object',
  fields,
})
const array = (fields: Record<string, PolicyFieldSchema>): PolicyFieldSchema => ({
  kind: 'array',
  item: object(fields),
})
const map = (item: PolicyFieldSchema, placeholder: string): PolicyFieldSchema => ({
  kind: 'map',
  item,
  placeholder,
})

// 与 Headscale v0.29.6 的 policy/v2/types.go、test.go 保持一致。
export const policyFields: Record<string, PolicyFieldSchema> = {
  grants: array({
    src: list('group:ops'),
    dst: list('tag:server'),
    ip: list('tcp:443'),
    app: { kind: 'json' },
    via: list('tag:router'),
  }),
  acls: array({
    action: { kind: 'string', options: ['accept'] },
    proto: text('tcp'),
    src: list('group:ops'),
    dst: list('tag:server:443'),
  }),
  tagOwners: map(list('group:ops'), 'tag:server'),
  groups: map(list('alice@'), 'group:ops'),
  hosts: map(text('10.0.0.0/24'), 'office'),
  ssh: array({
    action: { kind: 'string', options: ['accept', 'check'] },
    src: list('group:ops'),
    dst: list('tag:server'),
    users: list('autogroup:nonroot'),
    checkPeriod: text('12h'),
    acceptEnv: list('LANG'),
  }),
  autoApprovers: object({
    routes: map(list('group:ops'), '10.0.0.0/24'),
    exitNode: list('tag:router'),
  }),
  nodeAttrs: array({
    target: list('tag:server'),
    attr: list('randomize-client-port'),
    ipPool: list('100.64.0.0/24'),
  }),
  tests: array({
    src: text('alice@'),
    proto: text('tcp'),
    accept: list('tag:server:443'),
    deny: list('tag:server:22'),
  }),
  sshTests: array({
    src: text('alice@'),
    dst: list('tag:server'),
    accept: list('root'),
    deny: list('root'),
    check: list('autogroup:nonroot'),
  }),
  randomizeClientPort: { kind: 'boolean' },
}
export const policySections = [
  { id: 'access', fields: ['grants', 'acls'] },
  { id: 'tags', fields: ['tagOwners'] },
  { id: 'groups', fields: ['groups'] },
  { id: 'hosts', fields: ['hosts'] },
  { id: 'ssh', fields: ['ssh'] },
  { id: 'routes', fields: ['autoApprovers'] },
  { id: 'attributes', fields: ['nodeAttrs'] },
  { id: 'tests', fields: ['tests', 'sshTests'] },
  { id: 'options', fields: ['randomizeClientPort'] },
] as const

export function fieldDefault(schema: PolicyFieldSchema): unknown {
  if (schema.kind === 'boolean') return false
  if (schema.kind === 'list' || schema.kind === 'array') return []
  if (schema.kind === 'string') return schema.options?.[0] ?? ''
  return {}
}
