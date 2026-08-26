import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import UsersPage from '@/features/users/UsersPage.vue'
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
