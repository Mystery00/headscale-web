import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { NConfigProvider, NDialogProvider, NMessageProvider, NNotificationProvider } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { RouterView } from 'vue-router'
import { createAppI18n } from '@/i18n'
import { queryKeys } from '@/query/keys'
import { createAppRouter } from '@/router'
import { credentialStore } from '@/stores/credentials'
import { useSettingsStore, type ThemePreference } from '@/stores/settings'
import { server } from '../msw/server'

async function renderShell(path: string, theme: ThemePreference = 'dark') {
  const pinia = createPinia()
  setActivePinia(pinia)
  credentialStore.clear()
  credentialStore.setApiKey('test-key', 'session')
  useSettingsStore().update({
    baseUrl: 'http://hs.example.com',
    theme,
  })
  const i18n = createAppI18n('en-US')
  const router = createAppRouter()
  await router.push(path)
  await router.isReady()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  const Root = defineComponent({
    setup() {
      return () =>
        h(NConfigProvider, null, {
          default: () =>
            h(NMessageProvider, null, {
              default: () =>
                h(NNotificationProvider, null, {
                  default: () =>
                    h(NDialogProvider, null, {
                      default: () => h(RouterView),
                    }),
                }),
            }),
        })
    },
  })

  const view = render(Root, {
    global: {
      plugins: [pinia, router, i18n, [VueQueryPlugin, { queryClient }]],
    },
  })
  return { ...view, router, queryClient }
}

describe('AppShell', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    credentialStore.clear()
  })
  afterEach(() => {
    server.resetHandlers()
  })
  afterAll(() => {
    server.close()
  })

  it('renders a labelled admin navigation and main content region', async () => {
    await renderShell('/')
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
  })

  it('opens the navigation drawer from the mobile menu button', async () => {
    await renderShell('/')
    await fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(
      screen.getAllByRole('navigation', { name: 'Primary navigation' }).length,
    ).toBeGreaterThan(1)
  })

  it('names the mobile navigation drawer dialog', async () => {
    await renderShell('/')
    await fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('dialog', { name: 'Primary navigation' })).toBeTruthy()
  })

  it('applies the dark admin theme class on the authenticated shell', async () => {
    const { container } = await renderShell('/')
    expect(container.querySelector('.admin-theme-dark')).toBeTruthy()
  })

  it('applies the light admin theme class to the teleported mobile drawer', async () => {
    await renderShell('/', 'light')
    await fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const dialog = screen.getByRole('dialog', { name: 'Primary navigation' })
    expect(dialog.className).toMatch(/admin-theme-light/)
    expect(dialog.querySelector('.app-shell__drawer-content')).toBeTruthy()
  })

  it('shows instance status with version and database badges', async () => {
    await renderShell('/')
    expect(await screen.findByLabelText('Version: 0.29.3')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Database connected')).toBeTruthy()
    })
    expect(screen.getByText('http://hs.example.com')).toBeTruthy()
  })

  it('closes the drawer after navigating to another route', async () => {
    const { router } = await renderShell('/')
    await fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(
      screen.getAllByRole('navigation', { name: 'Primary navigation' }).length,
    ).toBeGreaterThan(1)
    await router.push('/users')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Primary navigation' })).toBeNull()
    })
  })

  it('closes the drawer when selecting the current route', async () => {
    await renderShell('/')
    await fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('dialog', { name: 'Primary navigation' })).toBeTruthy()
    const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' })
    await fireEvent.click(dashboardLinks[dashboardLinks.length - 1]!)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Primary navigation' })).toBeNull()
    })
  })

  it('confirms before clearing cached query data when disconnecting', async () => {
    const { queryClient, router } = await renderShell('/')
    queryClient.setQueryData(queryKeys.users(), [
      {
        id: '1',
        name: 'stale-user',
        displayName: 'Stale',
        email: '',
        provider: '',
        providerId: '',
        profilePictureUrl: '',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      },
    ])
    expect(queryClient.getQueryData(queryKeys.users())).toBeTruthy()

    await fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(screen.getByRole('dialog', { name: 'Disconnect' })).toBeTruthy()
    expect(router.currentRoute.value.path).toBe('/')
    expect(queryClient.getQueryData(queryKeys.users())).toBeTruthy()
    expect(credentialStore.getApiKey()).toBe('test-key')

    const disconnectButtons = screen.getAllByRole('button', { name: 'Disconnect' })
    await fireEvent.click(disconnectButtons[disconnectButtons.length - 1]!)
    await waitFor(() => {
      expect(router.currentRoute.value.path).toBe('/connect')
    })
    expect(queryClient.getQueryData(queryKeys.users())).toBeUndefined()
    expect(credentialStore.getApiKey()).toBeNull()
  })
})
