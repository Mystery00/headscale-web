import { describe, expect, it } from 'vitest'
import { mapNode } from '@/mappers/node-mapper'
import { mapRoutesFromNodes } from '@/mappers/route-mapper'

describe('mapRoutesFromNodes', () => {
  it('derives advertised, approved, serving, and exit flags', () => {
    const node = mapNode({
      id: '5',
      name: 'gw',
      givenName: 'gateway',
      user: { id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' },
      createdAt: '2024-01-02T03:04:05Z',
      availableRoutes: ['10.0.0.0/8', '0.0.0.0/0', '::/0'],
      approvedRoutes: ['10.0.0.0/8'],
      subnetRoutes: ['10.0.0.0/8'],
    })

    const routes = mapRoutesFromNodes([node])
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '5:10.0.0.0/8',
          advertised: true,
          approved: true,
          serving: true,
          exitRoute: false,
        }),
        expect.objectContaining({
          id: '5:0.0.0.0/0',
          advertised: true,
          approved: false,
          serving: false,
          exitRoute: true,
        }),
        expect.objectContaining({
          id: '5:::/0',
          advertised: true,
          exitRoute: true,
        }),
      ]),
    )
  })
})
