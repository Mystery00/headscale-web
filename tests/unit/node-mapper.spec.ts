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
    expect(node.user.name).toBe('alice')
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

  it('throws when id is missing', () => {
    expect(() => mapNode({ user, createdAt: '2024-01-02T03:04:05Z' })).toThrow('missing id')
  })
})
