import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import RoutesPage from '@/features/routes/RoutesPage.vue'
import { queryKeys } from '@/query/keys'
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

  it('restores search and filter state from the URL', async () => {
    await renderConnected('/routes?filter=pending&q=0.0.0.0', RoutesPage)
    expect(await screen.findByDisplayValue('0.0.0.0')).toBeTruthy()
    expect(screen.getByLabelText('Filter').textContent).toContain('Pending')
    expect(screen.queryByText('10.0.0.0/8')).toBeNull()
  })

  it('applies search together with a non-default filter', async () => {
    const { queryClient } = await renderConnected(
      '/routes?filter=pending&q=does-not-match',
      RoutesPage,
    )
    expect(await screen.findByDisplayValue('does-not-match')).toBeTruthy()
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.nodes())).toBeTruthy())
    expect(await screen.findByText('No data')).toBeTruthy()
    expect(screen.queryByText('0.0.0.0/0')).toBeNull()
  })

  it('asks for confirmation before revoking a route', async () => {
    await renderConnected('/routes', RoutesPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }))
    expect(screen.getByRole('dialog', { name: 'Revoke route' })).toBeTruthy()
  })
})
