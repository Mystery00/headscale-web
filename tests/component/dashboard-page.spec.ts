import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
import DashboardPage from '@/features/dashboard/DashboardPage.vue'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

describe('DashboardPage', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('shows counts from existing queries', async () => {
    await renderConnected('/', DashboardPage)
    await waitFor(() => {
      expect(screen.getByText('0.29.3')).toBeTruthy()
    })
    expect(screen.getByText('Dashboard')).toBeTruthy()
  })
})
