import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import SettingsPage from '@/features/settings/SettingsPage.vue'
import { STORAGE_KEYS } from '@/domain/storage-keys'
import { useSettingsStore } from '@/stores/settings'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

describe('SettingsPage', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => {
    server.resetHandlers()
    sessionStorage.clear()
    localStorage.clear()
  })
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

  it('persists the URL and migrates the current credential between storage modes', async () => {
    await renderConnected('/settings', SettingsPage)
    await fireEvent.update(screen.getByLabelText('Headscale URL'), 'http://new.example.com/')
    await fireEvent.click(
      screen.getByRole('checkbox', { name: 'I understand the risk of long-term storage' }),
    )
    await fireEvent.click(screen.getByRole('radio', { name: 'Remember on this device' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(useSettingsStore().baseUrl).toBe('http://new.example.com')
    expect(localStorage.getItem(STORAGE_KEYS.apiKeyLocal)).toBe('test-key')
    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBeNull()

    await fireEvent.click(
      screen.getByRole('checkbox', { name: 'I understand the risk of long-term storage' }),
    )
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBe('test-key')
    expect(localStorage.getItem(STORAGE_KEYS.apiKeyLocal)).toBeNull()
  })

  it('asks for confirmation before disconnecting', async () => {
    await renderConnected('/settings', SettingsPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))
    expect(screen.getByRole('dialog', { name: 'Disconnect' })).toBeTruthy()
  })
})
