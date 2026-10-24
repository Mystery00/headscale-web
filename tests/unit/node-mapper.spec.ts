import { describe, expect, it } from 'vitest'
import { mapNode } from '@/mappers/node-mapper'

const user = {
  id: '1',
  name: 'alice',
  createdAt: '2024-01-02T03:04:05Z',
}

describe('mapNode', () => {
  it('maps tags and register method from 0.29 fields', () => {
    const node = mapNode({
      id: '42',
      name: 'laptop',
      givenName: 'alice-laptop',
      machineKey: 'mkey-abcdefghijklmnopqrstuvwxyz',
      nodeKey: 'nkey-abcdefghijklmnopqrstuvwxyz',
      discoKey: 'dkey-abcdefghijklmnopqrstuvwxyz',
      ipAddresses: ['100.64.0.2'],
      user,
      lastSeen: '2024-02-01T00:00:00Z',
      expiry: '2024-12-01T00:00:00Z',
      createdAt: '2024-01-02T03:04:05Z',
      registerMethod: 'REGISTER_METHOD_AUTH_KEY',
      online: true,
      tags: ['tag:lab'],
      approvedRoutes: ['10.0.0.0/8'],
      availableRoutes: ['10.0.0.0/8', '0.0.0.0/0'],
      subnetRoutes: ['10.0.0.0/8'],
      preAuthKey: { id: '7', key: 'hskey-abcdefghijklmnopqrstuvwxyz' },
    })

    expect(node.id).toBe('42')
    expect(node.user?.name).toBe('alice')
    expect(node.registerMethod).toBe('auth-key')
    expect(node.tags).toEqual(['tag:lab'])
    expect(node.preAuthKey).toEqual({ id: '7', keyPreview: 'hske…wxyz' })
    expect(node.lastSeen).toEqual(new Date('2024-02-01T00:00:00Z'))
  })

  it('maps unknown register methods to unspecified', () => {
    const node = mapNode({
      id: '1',
      user,
      createdAt: '2024-01-02T03:04:05Z',
      registerMethod: 'REGISTER_METHOD_UNSPECIFIED',
    })
    expect(node.registerMethod).toBe('unspecified')
  })

  it.each([null, undefined])('maps a tagged node with user %s', (user) => {
    const node = mapNode({
      id: '42',
      user,
      tags: ['tag:server'],
      createdAt: '2024-01-02T03:04:05Z',
    })
    expect(node.user).toBeNull()
    expect(node.tags).toEqual(['tag:server'])
  })

  it('normalizes the synthetic tagged-devices list owner without requiring a user date', () => {
    const node = mapNode({
      id: '42',
      user: { id: '2147455555', name: 'tagged-devices' },
      tags: ['tag:server'],
      createdAt: '2024-01-02T03:04:05Z',
    })
    expect(node.user).toBeNull()
  })

  it('still rejects a missing owner on an untagged node', () => {
    expect(() => mapNode({ id: '42', createdAt: '2024-01-02T03:04:05Z' })).toThrow('missing user')
  })

  it('throws when id is missing', () => {
    expect(() => mapNode({ user, createdAt: '2024-01-02T03:04:05Z' })).toThrow('missing id')
  })
})
