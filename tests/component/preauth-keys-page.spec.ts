import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
import PreAuthKeysPage from '@/features/preauth-keys/PreAuthKeysPage.vue'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

describe('PreAuthKeysPage', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('shows a key preview instead of the full key', async () => {
    await renderConnected('/preauth-keys', PreAuthKeysPage)
    await waitFor(() => {
      expect(screen.getByText('hske…wxyz')).toBeTruthy()
    })
    expect(screen.queryByText('hskey-abcdefghijklmnopqrstuvwxyz')).toBeNull()
  })
})
