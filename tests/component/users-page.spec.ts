import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import { delay, http, HttpResponse } from 'msw'
import UsersPage from '@/features/users/UsersPage.vue'
import { queryKeys } from '@/query/keys'
import { useSettingsStore } from '@/stores/settings'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

describe('UsersPage', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('renders users from the repository', async () => {
    await renderConnected('/users', UsersPage)
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy()
    })
    expect(screen.getByRole('table', { name: 'Users' })).toBeTruthy()
    expect(screen.getByText('alice@example.com')).toBeTruthy()
  })

  it('shows related node counts and links to the filtered nodes page', async () => {
    const { router } = await renderConnected('/users', UsersPage)

    const countLink = await screen.findByRole('button', {
      name: 'View 1 related nodes for alice',
    })
    await fireEvent.click(countLink)

    await waitFor(() => expect(router.currentRoute.value.path).toBe('/nodes'))
    expect(router.currentRoute.value.query.userId).toBe('1')
  })

  it('keeps stale rows visible but surfaces a failed background refresh', async () => {
    const { queryClient } = await renderConnected('/users', UsersPage)
    expect(await screen.findByText('alice')).toBeTruthy()
    server.use(
      http.get('http://hs.example.com/api/v1/user', () =>
        HttpResponse.json({ message: 'failed' }, { status: 500 }),
      ),
    )
    await queryClient.invalidateQueries({ queryKey: queryKeys.users() })
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.getByText('alice')).toBeTruthy()
  })

  it('blocks deletion when the related-node count is unavailable', async () => {
    server.use(
      http.get('http://hs.example.com/api/v1/node', () =>
        HttpResponse.json({ message: 'failed' }, { status: 500 }),
      ),
    )
    await renderConnected('/users', UsersPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Details' }))
    expect(screen.getAllByText('Unavailable')).toHaveLength(2)
    expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('closes an open delete confirmation when the related-node query fails', async () => {
    const { queryClient } = await renderConnected('/users', UsersPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Details' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await fireEvent.update(screen.getByLabelText('Type the user name to confirm'), 'alice')
    expect(
      (screen.getByRole('button', { name: 'Confirm delete' }) as HTMLButtonElement).disabled,
    ).toBe(false)

    server.use(
      http.get('http://hs.example.com/api/v1/node', async () => {
        await delay(200)
        return HttpResponse.json({ message: 'failed' }, { status: 500 })
      }),
    )
    const refetch = queryClient.invalidateQueries({ queryKey: queryKeys.nodes() })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete user' })).toBeNull()
    })
    await refetch
    expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('uses the configured relative date style', async () => {
    await renderConnected('/users', UsersPage)
    useSettingsStore().update({ dateTimeStyle: 'relative' })
    expect(await screen.findByText(/ago$/)).toBeTruthy()
  })

  it('requires the exact user name before deletion', async () => {
    await renderConnected('/users', UsersPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Details' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete user' })).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Confirm delete' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})
