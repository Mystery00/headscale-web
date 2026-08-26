import { describe, expect, it } from 'vitest'
import { mapNode } from '@/mappers/node-mapper'
import { nextApprovedRoutes } from '@/domain/route-approval'

const node = mapNode({
  id: '5',
  name: 'gw',
  givenName: 'gateway',
  user: { id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' },
  createdAt: '2024-01-02T03:04:05Z',
  approvedRoutes: ['10.0.0.0/8'],
  availableRoutes: ['10.0.0.0/8', '0.0.0.0/0', '::/0'],
})

describe('nextApprovedRoutes', () => {
  it('adds both exit prefixes when approving one exit', () => {
    expect(nextApprovedRoutes(node, '0.0.0.0/0', true)).toEqual(
      expect.arrayContaining(['0.0.0.0/0', '::/0', '10.0.0.0/8']),
    )
    expect(nextApprovedRoutes(node, '0.0.0.0/0', true)).toHaveLength(3)
  })

  it('removes a subnet without touching other prefixes', () => {
    expect(nextApprovedRoutes(node, '10.0.0.0/8', false)).toEqual([])
  })
})
