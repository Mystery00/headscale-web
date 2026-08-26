import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
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
    expect(screen.getByText('alice@example.com')).toBeTruthy()
  })
})
