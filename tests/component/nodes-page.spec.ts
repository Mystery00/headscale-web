import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
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

  it('requires confirmation before expiring a node immediately', async () => {
    await renderConnected('/nodes', NodesPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Details' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Expire now' }))
    expect(screen.getByRole('dialog', { name: 'Expire node now' })).toBeTruthy()
  })
})
