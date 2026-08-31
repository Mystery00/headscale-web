import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import SettingsPage from '@/features/settings/SettingsPage.vue'
import { STORAGE_KEYS } from '@/domain/storage-keys'
import { useSettingsStore } from '@/stores/settings'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

const CURRENT_KEY = `hskey-api-ABCDEFGHIJKL-${'x'.repeat(64)}`
const BASE_URL = 'http://hs.example.com'

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
    await renderConnected('/settings', SettingsPage, { apiKey: 'test-key' })
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

  it('shows healthy metadata for the matching current API key', async () => {
    await renderConnected('/settings', SettingsPage)
    expect(await screen.findByText('Healthy')).toBeTruthy()
    expect(screen.getByText('hskey-api-TESTPREFIX12-***')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Replace API key' })).toBeNull()
  })

  it('shows keys without an expiration as non-expiring', async () => {
    server.use(
      http.get(`${BASE_URL}/api/v1/apikey`, () =>
        HttpResponse.json({
          apiKeys: [
            {
              id: '7',
              prefix: 'hskey-api-ABCDEFGHIJKL-***',
              createdAt: '2026-08-01T00:00:00Z',
            },
          ],
        }),
      ),
    )
    await renderConnected('/settings', SettingsPage, { apiKey: CURRENT_KEY })
    expect(await screen.findByText('No expiration')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Replace API key' })).toBeNull()
  })

  it('shows a manual replacement guide when the current key has exactly 30 days left', async () => {
    const expiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const mutations: string[] = []
    server.use(
      http.get(`${BASE_URL}/api/v1/apikey`, () =>
        HttpResponse.json({
          apiKeys: [
            {
              id: '7',
              prefix: 'hskey-api-ABCDEFGHIJKL-***',
              expiration,
              createdAt: '2026-08-01T00:00:00Z',
              lastSeen: '2026-08-30T00:00:00Z',
            },
          ],
        }),
      ),
      http.post(`${BASE_URL}/api/v1/apikey`, ({ request }) => {
        mutations.push(request.method)
        return HttpResponse.json({})
      }),
      http.post(`${BASE_URL}/api/v1/apikey/expire`, ({ request }) => {
        mutations.push(request.method)
        return HttpResponse.json({})
      }),
    )

    await renderConnected('/settings', SettingsPage, { apiKey: CURRENT_KEY })
    expect(await screen.findByText('Expiring soon')).toBeTruthy()
    await fireEvent.click(screen.getByRole('button', { name: 'Replace API key' }))
    expect(screen.getByText('headscale apikeys create --expiration 90d')).toBeTruthy()
    expect(screen.getByText('headscale apikeys expire --prefix ABCDEFGHIJKL')).toBeTruthy()
    expect(mutations).toEqual([])
  })

  it('keeps settings available when the current API key status cannot be identified', async () => {
    await renderConnected('/settings', SettingsPage, { apiKey: 'malformed-key' })
    expect(await screen.findByText('Status unavailable')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Connection' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Refresh' })).toBeTruthy()
  })
  it('asks for confirmation before disconnecting', async () => {
    await renderConnected('/settings', SettingsPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }))
    expect(screen.getByRole('dialog', { name: 'Disconnect' })).toBeTruthy()
  })
})
