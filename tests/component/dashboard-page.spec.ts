import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
import { http, HttpResponse } from 'msw'
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

  it('shows a retry action instead of zero metrics when a read fails', async () => {
    server.use(
      http.get('http://hs.example.com/api/v1/user', () =>
        HttpResponse.json({ message: 'failed' }, { status: 500 }),
      ),
    )
    await renderConnected('/', DashboardPage)
    expect(await screen.findByText('Could not load data')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.queryByLabelText('Dashboard metrics')).toBeNull()
  })

  it('groups network health and attention items into labelled regions', async () => {
    await renderConnected('/', DashboardPage)
    expect(await screen.findByRole('region', { name: 'Network overview' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Needs attention' })).toBeTruthy()
    expect(await screen.findByText('0.0.0.0/0')).toBeTruthy()
    const pendingRoute = screen.getByRole('link', { name: /0\.0\.0\.0\/0/ })
    expect(pendingRoute.getAttribute('href')).toContain('/routes?')
    expect(pendingRoute.getAttribute('href')).toContain('filter=pending')
  })
})
