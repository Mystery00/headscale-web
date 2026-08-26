import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
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
    expect(screen.getByText('Online')).toBeTruthy()
    expect(screen.queryByText('mkey-abcdefghijklmnopqrstuvwxyz')).toBeNull()
  })
})
