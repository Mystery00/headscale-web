import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import RoutesPage from '@/features/routes/RoutesPage.vue'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

describe('RoutesPage', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('derives routes from nodes', async () => {
    await renderConnected('/routes', RoutesPage)
    await waitFor(() => {
      expect(screen.getByText('10.0.0.0/8')).toBeTruthy()
    })
    expect(screen.getByRole('table', { name: 'Routes' })).toBeTruthy()
    expect(screen.getByText('0.0.0.0/0')).toBeTruthy()
  })

  it('asks for confirmation before revoking a route', async () => {
    await renderConnected('/routes', RoutesPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }))
    expect(screen.getByRole('dialog', { name: 'Revoke route' })).toBeTruthy()
  })
})
