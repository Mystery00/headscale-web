import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/vue'
import { http, HttpResponse } from 'msw'
import type { components } from '@/api/generated/headscale'
import type { Node } from '@/domain/node'
import DashboardPage from '@/features/dashboard/DashboardPage.vue'
import NodesPage from '@/features/nodes/NodesPage.vue'
import RoutesPage from '@/features/routes/RoutesPage.vue'
import UsersPage from '@/features/users/UsersPage.vue'
import { queryKeys } from '@/query/keys'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

type NodeDto = Omit<components['schemas']['v1Node'], 'user'> & {
  user?: components['schemas']['v1User'] | null
}

const alice = { id: '1', name: 'alice', createdAt: '2024-01-01T00:00:00Z' }
const bob = { id: '2', name: 'bob', createdAt: '2024-01-01T00:00:00Z' }
// Headscale's list endpoint uses a synthetic owner, unlike mutation/detail responses.
const taggedOwner = { id: '2147455555', name: 'tagged-devices' }

function taggedNode(overrides: Partial<NodeDto> = {}): NodeDto {
  return {
    id: '42',
    name: 'router',
    givenName: 'tagged-router',
    user: null,
    tags: ['tag:router'],
    createdAt: '2024-01-01T00:00:00Z',
    ipAddresses: ['100.64.0.42'],
    online: false,
    availableRoutes: ['10.42.0.0/16'],
    approvedRoutes: [],
    ...overrides,
  }
}

function mixedNodes(): NodeDto[] {
  return [
    taggedNode({ user: taggedOwner }),
    taggedNode({ id: '43', givenName: 'null-owner-node' }),
    taggedNode({ id: '44', givenName: 'omitted-owner-node', user: undefined }),
    taggedNode({ id: '1', givenName: 'alice-laptop', user: alice, tags: [], online: true }),
    taggedNode({ id: '2', givenName: 'alice-tagged-node', user: alice, online: true }),
  ]
}

function mockNodes(nodes = mixedNodes()) {
  server.use(
    http.get('http://hs.example.com/api/v1/user', () => HttpResponse.json({ users: [alice, bob] })),
    http.get('http://hs.example.com/api/v1/node', () => HttpResponse.json({ nodes })),
  )
}

function nodeRow(name: string) {
  const row = screen.getByText(name).closest('tr')
  expect(row).not.toBeNull()
  return within(row!)
}

describe('tagged nodes across connected pages', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('标签被拒绝时展示服务器原因和策略提示，并保留原节点归属', async () => {
    mockNodes([taggedNode({ user: alice, tags: [] })])
    const reason = 'requested tags [tag:missing] are invalid or not permitted'
    server.use(
      http.post('http://hs.example.com/api/v1/node/42/tags', () =>
        HttpResponse.json({ code: 3, message: reason, details: [] }, { status: 400 }),
      ),
    )
    await renderConnected('/nodes', NodesPage)
    await screen.findByText('tagged-router')
    await fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    await fireEvent.update(screen.getByLabelText('Set tags'), 'tag:missing')
    await fireEvent.click(screen.getByRole('button', { name: 'Set tags' }))

    expect(await screen.findByText(reason, { exact: false })).toBeTruthy()
    expect(screen.getByText(/tagOwners/)).toBeTruthy()
    expect(screen.getByText('alice', { selector: 'dd' })).toBeTruthy()
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('renders mixed owners and nullable tagged-node details without inventing a user', async () => {
    mockNodes()
    const { queryClient } = await renderConnected('/nodes', NodesPage)

    await screen.findByText('tagged-router')
    for (const name of ['tagged-router', 'null-owner-node', 'omitted-owner-node']) {
      expect(nodeRow(name).getByText('Tagged devices')).toBeTruthy()
    }
    expect(nodeRow('alice-laptop').getByText('alice')).toBeTruthy()
    expect(nodeRow('alice-tagged-node').getByText('alice')).toBeTruthy()
    expect(screen.queryByText('tagged-devices')).toBeNull()
    expect(queryClient.getQueryData<Node[]>(queryKeys.nodes())?.slice(0, 3)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '42', user: null }),
        expect.objectContaining({ id: '43', user: null }),
        expect.objectContaining({ id: '44', user: null }),
      ]),
    )

    await fireEvent.click(nodeRow('null-owner-node').getByRole('button', { name: 'Details' }))
    expect(await screen.findByDisplayValue('null-owner-node')).toBeTruthy()
    expect(screen.getAllByText('Tagged devices')).toHaveLength(4)
    expect(screen.queryByText('Could not load data')).toBeNull()
  })

  it('sorts mixed owners and searches the displayed tagged-owner label', async () => {
    mockNodes()
    const { router } = await renderConnected('/nodes?sort=user&order=ascend', NodesPage)

    await screen.findByText('tagged-router')
    const table = screen.getByRole('table', { name: 'Nodes' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(5)
    expect(within(rows[0]!).getByText('alice')).toBeTruthy()
    expect(within(rows[1]!).getByText('alice')).toBeTruthy()
    expect(within(rows[2]!).getByText('Tagged devices')).toBeTruthy()

    await fireEvent.update(screen.getByLabelText('Search'), 'Tagged devices')
    await waitFor(() => expect(router.currentRoute.value.query.q).toBe('Tagged devices'))
    expect(screen.getByText('tagged-router')).toBeTruthy()
    expect(screen.getByText('null-owner-node')).toBeTruthy()
    expect(screen.getByText('omitted-owner-node')).toBeTruthy()
    expect(screen.queryByText('alice-laptop')).toBeNull()
    expect(screen.queryByText('alice-tagged-node')).toBeNull()
  })

  it.each([
    {
      userId: '2147455555',
      label: 'Tagged devices',
      included: 'tagged-router',
      excluded: 'alice-laptop',
      count: 3,
    },
    {
      userId: '1',
      label: 'alice',
      included: 'alice-tagged-node',
      excluded: 'tagged-router',
      count: 2,
    },
  ])(
    'restores the $label owner filter from its URL ID',
    async ({ userId, label, included, excluded, count }) => {
      mockNodes()
      await renderConnected(`/nodes?userId=${userId}`, NodesPage)

      expect(await screen.findByText(included)).toBeTruthy()
      expect(screen.getByLabelText('Owner').textContent).toContain(label)
      expect(screen.queryByText(excluded)).toBeNull()
      expect(screen.getAllByRole('button', { name: 'Details' })).toHaveLength(count)
    },
  )

  it.each(['rename', 'tags', 'expire'] as const)(
    'accepts a null owner after %s and invalidates both node caches',
    async (operation) => {
      let current = taggedNode(
        operation === 'tags' ? { user: alice, tags: [] } : { user: taggedOwner },
      )
      let listReads = 0
      let writeCount = 0
      let requestBody: unknown
      const suffix = operation === 'rename' ? 'rename/renamed-router' : operation
      const expiry = '2024-02-01T00:00:00Z'
      server.use(
        http.get('http://hs.example.com/api/v1/node', () => {
          listReads += 1
          return HttpResponse.json({ nodes: [current] })
        }),
        http.post(`http://hs.example.com/api/v1/node/42/${suffix}`, async ({ request }) => {
          writeCount += 1
          if (operation !== 'rename') requestBody = await request.json()
          current = {
            ...current,
            user: null,
            ...(operation === 'rename' ? { givenName: 'renamed-router' } : {}),
            ...(operation === 'tags' ? { tags: ['tag:updated'] } : {}),
            ...(operation === 'expire' ? { expiry } : {}),
          }
          return HttpResponse.json({ node: current })
        }),
      )
      const { queryClient } = await renderConnected('/nodes', NodesPage)
      await screen.findByText('tagged-router')
      queryClient.setQueryData(
        queryKeys.node('42'),
        queryClient.getQueryData<Node[]>(queryKeys.nodes())![0],
      )
      await fireEvent.click(screen.getByRole('button', { name: 'Details' }))

      if (operation === 'rename') {
        await fireEvent.update(screen.getByLabelText('Rename'), 'renamed-router')
        await fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
      } else if (operation === 'tags') {
        await fireEvent.update(screen.getByLabelText('Set tags'), 'tag:updated')
        await fireEvent.click(screen.getByRole('button', { name: 'Set tags' }))
      } else {
        await fireEvent.click(screen.getByRole('button', { name: 'Expire now' }))
        const confirmation = screen.getByRole('dialog', { name: 'Expire node now' })
        await fireEvent.click(within(confirmation).getByRole('button', { name: 'Expire now' }))
      }

      expect(await screen.findByText('Saved')).toBeTruthy()
      await waitFor(() => expect(listReads).toBeGreaterThan(1))
      expect(writeCount).toBe(1)
      expect(queryClient.getQueryState(queryKeys.node('42'))?.isInvalidated).toBe(true)
      const updated = queryClient.getQueryData<Node[]>(queryKeys.nodes())![0]!
      expect(updated.user).toBeNull()
      if (operation === 'rename') {
        expect(updated.givenName).toBe('renamed-router')
        expect(
          within(screen.getByRole('table', { name: 'Nodes', hidden: true })).getByText(
            'renamed-router',
          ),
        ).toBeTruthy()
        expect(screen.getByRole('heading', { name: 'renamed-router' })).toBeTruthy()
      } else if (operation === 'tags') {
        expect(requestBody).toEqual({ tags: ['tag:updated'] })
        expect(updated.tags).toEqual(['tag:updated'])
        expect(screen.getByText('tag:updated')).toBeTruthy()
        expect(screen.getByText('Tagged devices', { selector: 'dd' })).toBeTruthy()
      } else {
        expect(requestBody).toEqual({})
        expect(updated.expiry).toEqual(new Date(expiry))
        await waitFor(() =>
          expect(screen.queryByRole('dialog', { name: 'Expire node now' })).toBeNull(),
        )
      }
      expect(screen.queryByText('The request failed')).toBeNull()
    },
  )

  it.each(['close', 'switch'] as const)(
    'does not replace the current selection when users %s during a tagged-node mutation',
    async (action) => {
      let current = taggedNode({ user: alice, tags: [] })
      const other = taggedNode({ id: '43', givenName: 'other-node', user: bob, tags: [] })
      let writeStarted = false
      let finishWrite!: () => void
      const pending = new Promise<void>((resolve) => {
        finishWrite = resolve
      })
      server.use(
        http.get('http://hs.example.com/api/v1/node', () =>
          HttpResponse.json({ nodes: [current, other] }),
        ),
        http.post('http://hs.example.com/api/v1/node/42/tags', async () => {
          writeStarted = true
          await pending
          current = { ...current, user: null, tags: ['tag:router'] }
          return HttpResponse.json({ node: current })
        }),
      )
      const { queryClient } = await renderConnected('/nodes', NodesPage)
      await screen.findByText('tagged-router')
      await fireEvent.click(nodeRow('tagged-router').getByRole('button', { name: 'Details' }))
      await fireEvent.update(screen.getByLabelText('Set tags'), 'tag:router')
      await fireEvent.click(screen.getByRole('button', { name: 'Set tags' }))
      try {
        await waitFor(() => expect(writeStarted).toBe(true))
        await fireEvent.click(screen.getByRole('button', { name: 'close' }))
        if (action === 'switch') {
          await fireEvent.click(nodeRow('other-node').getByRole('button', { name: 'Details' }))
          expect(screen.getByText('bob', { selector: 'dd' })).toBeTruthy()
        }
      } finally {
        finishWrite()
      }

      expect(await screen.findByText('Saved')).toBeTruthy()
      expect(queryClient.getQueryData<Node[]>(queryKeys.nodes())![0]!.user).toBeNull()
      if (action === 'switch') {
        expect(screen.getByRole('heading', { name: 'other-node' })).toBeTruthy()
        expect(screen.getByText('bob', { selector: 'dd' })).toBeTruthy()
        expect(screen.queryByText('Tagged devices', { selector: 'dd' })).toBeNull()
      } else {
        expect(screen.queryByLabelText('Rename')).toBeNull()
        expect(screen.queryByLabelText('Set tags')).toBeNull()
      }
    },
  )

  it('approves a tagged node route when the response has no user and refreshes the table', async () => {
    let current = taggedNode({ user: taggedOwner })
    let listReads = 0
    let requestBody: unknown
    server.use(
      http.get('http://hs.example.com/api/v1/node', () => {
        listReads += 1
        return HttpResponse.json({ nodes: [current] })
      }),
      http.post('http://hs.example.com/api/v1/node/42/approve_routes', async ({ request }) => {
        requestBody = await request.json()
        current = { ...current, user: null, approvedRoutes: ['10.42.0.0/16'] }
        return HttpResponse.json({ node: current })
      }),
    )
    const { queryClient } = await renderConnected('/routes', RoutesPage)
    await screen.findByText('10.42.0.0/16')
    queryClient.setQueryData(
      queryKeys.node('42'),
      queryClient.getQueryData<Node[]>(queryKeys.nodes())![0],
    )
    await fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(await screen.findByText('Saved')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Revoke' })).toBeTruthy()
    expect(requestBody).toEqual({ routes: ['10.42.0.0/16'] })
    expect(listReads).toBeGreaterThan(1)
    expect(queryClient.getQueryState(queryKeys.node('42'))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryData<Node[]>(queryKeys.nodes())![0]).toMatchObject({
      user: null,
      approvedRoutes: ['10.42.0.0/16'],
    })
    expect(screen.queryByText('The request failed')).toBeNull()
  })

  it('counts only real-user nodes and opens user details with nullable nodes present', async () => {
    mockNodes()
    await renderConnected('/users', UsersPage)

    expect(
      await screen.findByRole('button', { name: 'View 2 related nodes for alice' }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View 0 related nodes for bob' })).toBeTruthy()
    await fireEvent.click(nodeRow('alice').getByRole('button', { name: 'Details' }))
    const count = await screen.findByText('Related nodes', { selector: 'dt' })
    expect(count.nextElementSibling?.textContent).toBe('2')
    expect(screen.getByRole('button', { name: 'Delete' }).hasAttribute('disabled')).toBe(false)
    expect(screen.queryByText('Unavailable')).toBeNull()
  })

  it('renders offline tagged nodes in the dashboard attention list', async () => {
    mockNodes([
      taggedNode(),
      taggedNode({ id: '1', givenName: 'alice-laptop', user: alice, online: true }),
    ])
    await renderConnected('/', DashboardPage)

    const link = (await screen.findByText('tagged-router')).closest('a')!
    expect(link.textContent).toContain('Tagged devices')
    expect(link.textContent).toContain('100.64.0.42')
    expect(link.getAttribute('href')).toContain('status=offline')
    expect(link.getAttribute('href')).toContain('focus=42')
    expect(screen.getByLabelText('Dashboard metrics')).toBeTruthy()
    expect(screen.queryByText('Could not load data')).toBeNull()
  })
})
