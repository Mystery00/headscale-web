import { createPinia, setActivePinia } from 'pinia'
import { http, HttpResponse } from 'msw'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { NConfigProvider } from 'naive-ui'
import { defineComponent, h } from 'vue'
import { readFileSync } from 'node:fs'
import ConnectionPage from '@/features/connection/ConnectionPage.vue'
import { createAppI18n } from '@/i18n'
import { STORAGE_KEYS } from '@/domain/storage-keys'
import { credentialStore } from '@/stores/credentials'
import { useSettingsStore } from '@/stores/settings'
import { server } from '../msw/server'

const BASE_URL = 'http://hs.example.com'

async function renderPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const i18n = createAppI18n('en-US')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/connect', component: ConnectionPage },
      { path: '/', component: { template: '<div>connected-home</div>' } },
    ],
  })
  await router.push('/connect')
  const Root = defineComponent({
    setup() {
      return () => h(NConfigProvider, null, { default: () => h(ConnectionPage) })
    },
  })
  const view = render(Root, {
    global: {
      plugins: [pinia, router, i18n],
    },
  })
  return { ...view, router }
}

describe('ConnectionPage', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    credentialStore.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    server.resetHandlers()
  })
  afterAll(() => {
    server.close()
  })

  it('renders URL and API key fields', async () => {
    await renderPage()
    expect(screen.getByLabelText('Headscale URL')).toBeTruthy()
    expect(screen.getByLabelText('API Key')).toBeTruthy()
  })

  it('stores the key in sessionStorage by default and navigates home', async () => {
    const { router } = await renderPage()
    await fireEvent.update(screen.getByLabelText('Headscale URL'), BASE_URL)
    await fireEvent.update(screen.getByLabelText('API Key'), 'test-key')
    await fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => {
      expect(router.currentRoute.value.path).toBe('/')
    })
    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBe('test-key')
    expect(localStorage.getItem(STORAGE_KEYS.apiKeyLocal)).toBeNull()
    expect(useSettingsStore().baseUrl).toBe(BASE_URL)
  })

  it('keeps long-term storage disabled until the risk is confirmed', async () => {
    await renderPage()
    const localRadio = screen.getByLabelText('Remember on this device')
    expect((localRadio as HTMLInputElement).disabled).toBe(true)

    await fireEvent.click(screen.getByLabelText('I understand the risk of long-term storage'))
    expect((screen.getByLabelText('Remember on this device') as HTMLInputElement).disabled).toBe(
      false,
    )

    await fireEvent.click(screen.getByLabelText('Remember on this device'))
    await fireEvent.update(screen.getByLabelText('Headscale URL'), BASE_URL)
    await fireEvent.update(screen.getByLabelText('API Key'), 'test-key')
    await fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEYS.apiKeyLocal)).toBe('test-key')
    })
    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBeNull()
  })

  it('shows an unsupported-version message and does not store the key', async () => {
    server.use(
      http.get(`${BASE_URL}/version`, () => {
        return HttpResponse.json({ version: '0.28.0' })
      }),
    )
    await renderPage()
    await fireEvent.update(screen.getByLabelText('Headscale URL'), BASE_URL)
    await fireEvent.update(screen.getByLabelText('API Key'), 'test-key')
    await fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    expect(await screen.findByText('This UI only supports Headscale 0.29.x.')).toBeTruthy()
    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBeNull()
    expect(credentialStore.getApiKey()).toBeNull()
  })

  it('shows authorization failure and stays on the connection page', async () => {
    server.use(
      http.get(`${BASE_URL}/api/v1/user`, () => {
        return HttpResponse.json({ code: 16, message: 'unauthenticated' }, { status: 401 })
      }),
    )
    const { router } = await renderPage()
    await fireEvent.update(screen.getByLabelText('Headscale URL'), BASE_URL)
    await fireEvent.update(screen.getByLabelText('API Key'), 'test-key')
    await fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    expect(await screen.findByText('The API key was rejected.')).toBeTruthy()
    expect(router.currentRoute.value.path).toBe('/connect')
  })

  it('does not hardcode user-facing English or Chinese strings', () => {
    const source = readFileSync('src/features/connection/ConnectionPage.vue', 'utf8')
    expect(source).not.toMatch(/[\u4e00-\u9fff]/)
    expect(source).not.toMatch(/Connect to Headscale|Headscale URL|Remember on this device/)
  })
})
