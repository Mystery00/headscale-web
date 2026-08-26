import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createAppI18n } from '@/i18n'
import { createAppRouter } from '@/router'
import { credentialStore } from '@/stores/credentials'
import { useSettingsStore } from '@/stores/settings'
import type { Component } from 'vue'

export async function renderConnected(path: string, page?: Component) {
  const pinia = createPinia()
  setActivePinia(pinia)
  credentialStore.clear()
  credentialStore.setApiKey('test-key', 'session')
  useSettingsStore().update({ baseUrl: 'http://hs.example.com' })
  const i18n = createAppI18n('en-US')
  const router = page
    ? createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:pathMatch(.*)*', component: page }],
      })
    : createAppRouter()
  await router.push(path)
  await router.isReady()
  return render(
    { template: '<router-view />' },
    {
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
    },
  )
}
