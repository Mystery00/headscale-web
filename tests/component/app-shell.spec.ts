import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { NConfigProvider, NDialogProvider, NMessageProvider, NNotificationProvider } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { RouterView } from 'vue-router'
import { createAppI18n } from '@/i18n'
import { createAppRouter } from '@/router'
import { credentialStore } from '@/stores/credentials'
import { useSettingsStore } from '@/stores/settings'
import { server } from '../msw/server'

async function renderShell(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  credentialStore.clear()
  credentialStore.setApiKey('test-key', 'session')
  useSettingsStore().update({
    baseUrl: 'http://hs.example.com',
    theme: 'dark',
  })
  const i18n = createAppI18n('en-US')
  const router = createAppRouter()
  await router.push(path)
  await router.isReady()

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
      plugins: [
        pinia,
        router,
        i18n,
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
      ],
    },
  })
  return { ...view, router }
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

  it('applies the dark admin theme class on the authenticated shell', async () => {
    const { container } = await renderShell('/')
    expect(container.querySelector('.admin-theme-dark')).toBeTruthy()
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
      expect(screen.getAllByRole('navigation', { name: 'Primary navigation' })).toHaveLength(1)
    })
  })
})
