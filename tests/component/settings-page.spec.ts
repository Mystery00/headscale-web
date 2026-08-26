import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import SettingsPage from '@/features/settings/SettingsPage.vue'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

describe('SettingsPage', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('groups settings into connection, refresh, and appearance regions', async () => {
    await renderConnected('/settings', SettingsPage)
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeTruthy()
    })
    expect(screen.getByRole('region', { name: 'Connection' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Refresh' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Appearance' })).toBeTruthy()
    expect(screen.getByLabelText('Automatic polling')).toBeTruthy()
  })

  it('asks for confirmation before disconnecting', async () => {
    await renderConnected('/settings', SettingsPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))
    expect(screen.getByRole('dialog', { name: 'Disconnect' })).toBeTruthy()
  })
})
