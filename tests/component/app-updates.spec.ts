import { screen, waitFor } from '@testing-library/vue'
import { defineComponent, h } from 'vue'
import { http, HttpResponse, delay } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import AppNav from '@/features/shell/AppNav.vue'
import { useSettingsStore } from '@/stores/settings'
import { STORAGE_KEYS } from '@/domain/storage-keys'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

const version = vi.hoisted(() => ({ current: 'v0.1.3' }))
vi.mock('@/config/app', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/app')>()),
  get appVersion() {
    return version.current
  },
}))
const endpoint = 'https://api.github.com/repos/Mystery00/headscale-web/releases/latest'
const stable = { tag_name: 'v0.1.4', prerelease: false, draft: false }

describe('app update notification', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  beforeEach(() => {
    localStorage.clear()
    version.current = 'v0.1.3'
  })
  afterEach(() => {
    server.resetHandlers()
    sessionStorage.clear()
  })
  afterAll(() => server.close())

  it('shows a safe release link for a newer version without leaking credentials', async () => {
    let request: Request | undefined
    server.use(
      http.get(endpoint, ({ request: r }) => {
        request = r
        return HttpResponse.json(stable)
      }),
    )
    await renderConnected('/users', AppNav)
    const badge = await screen.findByRole('link', {
      name: 'Update available: v0.1.4 (opens in a new tab)',
    })
    expect(badge.textContent).toBe('Update available')
    expect(badge.getAttribute('href')).toBe(
      'https://github.com/Mystery00/headscale-web/releases/tag/v0.1.4',
    )
    expect(badge.getAttribute('target')).toBe('_blank')
    expect(badge.getAttribute('rel')).toContain('noreferrer')
    expect(request?.headers.get('Authorization')).toBeNull()
    expect(request?.credentials).toBe('omit')
    expect(
      screen
        .getByRole('link', { name: 'Headscale Web repository (opens in a new tab)' })
        .getAttribute('href'),
    ).toBe('https://github.com/Mystery00/headscale-web')
    useSettingsStore().update({ updateChecksEnabled: false })
    await waitFor(() => expect(screen.queryByText('Update available')).toBeNull())
  })

  it('deduplicates checking across desktop and mobile navigation', async () => {
    let calls = 0
    server.use(
      http.get(endpoint, async () => {
        calls++
        await delay(20)
        return HttpResponse.json(stable)
      }),
    )
    const Both = defineComponent({ setup: () => () => h('div', [h(AppNav), h(AppNav)]) })
    await renderConnected('/users', Both)
    await waitFor(() => expect(screen.getAllByText('Update available')).toHaveLength(2))
    expect(calls).toBe(1)
  })

  it.each(['v0.1.3', 'v0.1.2'])('does not advertise an update for %s', async (tag) => {
    server.use(http.get(endpoint, () => HttpResponse.json({ ...stable, tag_name: tag })))
    const { queryClient } = await renderConnected('/users', AppNav)
    await waitFor(() => expect(queryClient.getQueryState(['app-release'])?.status).toBe('success'))
    expect(screen.queryByText('Update available')).toBeNull()
  })

  it('silently tolerates GitHub failures without affecting navigation or credentials', async () => {
    server.use(http.get(endpoint, () => new HttpResponse(null, { status: 403 })))
    const { queryClient } = await renderConnected('/users', AppNav)
    await waitFor(() => expect(queryClient.getQueryState(['app-release'])?.status).toBe('success'))
    expect(screen.queryByText('Update available')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Nodes' })).toBeTruthy()
  })

  it.each(['disabled', 'dev'])('does not contact GitHub when %s', async (mode) => {
    let calls = 0
    server.use(
      http.get(endpoint, () => {
        calls++
        return HttpResponse.json(stable)
      }),
    )
    if (mode === 'dev') version.current = 'dev'
    else localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ updateChecksEnabled: false }))
    const { queryClient } = await renderConnected('/users', AppNav)
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(calls).toBe(0)
    expect(screen.queryByText('Update available')).toBeNull()
  })

  it('does not show an in-flight result after the preference is disabled', async () => {
    let started = false
    server.use(
      http.get(endpoint, async () => {
        started = true
        await delay(100)
        return HttpResponse.json(stable)
      }),
    )
    const { queryClient } = await renderConnected('/users', AppNav)
    await waitFor(() => expect(started).toBe(true))
    useSettingsStore().update({ updateChecksEnabled: false })
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    expect(screen.queryByText('Update available')).toBeNull()
    expect(localStorage.getItem('hs-web:v1:app-release')).toBeNull()
  })
})
