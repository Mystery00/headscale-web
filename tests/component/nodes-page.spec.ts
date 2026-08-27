import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import { http, HttpResponse } from 'msw'
import NodesPage from '@/features/nodes/NodesPage.vue'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

describe('NodesPage', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('renders nodes and masks keys in the table context', async () => {
    await renderConnected('/nodes', NodesPage)
    await waitFor(() => {
      expect(screen.getByText('alice-laptop')).toBeTruthy()
    })
    expect(screen.getByRole('table', { name: 'Nodes' })).toBeTruthy()
    expect(screen.getByText('Online')).toBeTruthy()
    expect(screen.queryByText('mkey-abcdefghijklmnopqrstuvwxyz')).toBeNull()
  })

  it('shows only the preferred node name and renders unique IP addresses as chips', async () => {
    server.use(
      http.get('http://hs.example.com/api/v1/node', () =>
        HttpResponse.json({
          nodes: [
            {
              id: '42',
              name: 'laptop',
              givenName: 'alice-laptop',
              machineKey: 'mkey-abcdefghijklmnopqrstuvwxyz',
              nodeKey: 'nkey-abcdefghijklmnopqrstuvwxyz',
              discoKey: 'dkey-abcdefghijklmnopqrstuvwxyz',
              ipAddresses: ['100.64.0.2', 'fd7a:115c:a1e0::2', '100.64.0.2'],
              user: {
                id: '1',
                name: 'alice',
                createdAt: '2024-01-02T03:04:05Z',
              },
              createdAt: '2024-01-02T03:04:05Z',
              registerMethod: 'REGISTER_METHOD_AUTH_KEY',
              online: true,
              tags: [],
            },
          ],
        }),
      ),
    )

    await renderConnected('/nodes', NodesPage)

    const preferredName = await screen.findByText('alice-laptop')
    expect(preferredName).toBeTruthy()
    expect(screen.queryByText('laptop')).toBeNull()
    const ipv4 = screen.getByText('100.64.0.2')
    const ipv6 = screen.getByText('fd7a:115c:a1e0::2')
    expect(screen.getAllByText('100.64.0.2')).toHaveLength(1)
    expect(ipv4.closest('.n-tag')).toBeTruthy()
    expect(ipv6.closest('.n-tag')).toBeTruthy()
  })

  it('applies the owner filter from the URL query', async () => {
    const alice = { id: '1', name: 'alice', createdAt: '2024-01-01T00:00:00Z' }
    const bob = { id: '2', name: 'bob', createdAt: '2024-01-01T00:00:00Z' }
    server.use(
      http.get('http://hs.example.com/api/v1/user', () =>
        HttpResponse.json({ users: [alice, bob] }),
      ),
      http.get('http://hs.example.com/api/v1/node', () =>
        HttpResponse.json({
          nodes: [
            {
              id: 'alice-node',
              name: 'alice-node',
              givenName: 'alice-node',
              user: alice,
              createdAt: '2024-01-01T00:00:00Z',
              ipAddresses: ['100.64.0.1'],
            },
            {
              id: 'bob-node',
              name: 'bob-node',
              givenName: 'bob-node',
              user: bob,
              createdAt: '2024-01-01T00:00:00Z',
              ipAddresses: ['100.64.0.2'],
            },
          ],
        }),
      ),
    )

    await renderConnected('/nodes?userId=2', NodesPage)

    expect(await screen.findByLabelText('Owner')).toBeTruthy()
    expect(await screen.findByText('bob-node')).toBeTruthy()
    expect(screen.queryByText('alice-node')).toBeNull()
  })

  it('falls back to node owners when the users query fails', async () => {
    const bob = { id: '2', name: 'bob', createdAt: '2024-01-01T00:00:00Z' }
    server.use(
      http.get('http://hs.example.com/api/v1/user', () =>
        HttpResponse.json({ message: 'failed' }, { status: 500 }),
      ),
      http.get('http://hs.example.com/api/v1/node', () =>
        HttpResponse.json({
          nodes: [
            {
              id: 'bob-node',
              name: 'bob-node',
              givenName: 'bob-node',
              user: bob,
              createdAt: '2024-01-01T00:00:00Z',
              ipAddresses: ['100.64.0.2'],
            },
          ],
        }),
      ),
    )

    await renderConnected('/nodes?userId=2', NodesPage)

    const ownerSelect = await screen.findByLabelText('Owner')
    await waitFor(() => expect(ownerSelect.textContent).toContain('bob'))
    expect(await screen.findByText('bob-node')).toBeTruthy()
  })

  it('requires confirmation before expiring a node immediately', async () => {
    await renderConnected('/nodes', NodesPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Details' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Expire now' }))
    expect(screen.getByRole('dialog', { name: 'Expire node now' })).toBeTruthy()
  })
})
