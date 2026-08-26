import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
import SettingsPage from '@/features/settings/SettingsPage.vue'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

describe('SettingsPage', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('renders polling and disconnect controls', async () => {
    await renderConnected('/settings', SettingsPage)
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeTruthy()
    })
    expect(screen.getByLabelText('Automatic polling')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy()
  })
})
