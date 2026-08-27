import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { deriveBasePathFromModuleUrl } from './domain/url'
import { createAppI18n } from './i18n'
import { createAppQueryClient } from './query/client'
import { createAppRouter } from './router'
import { credentialStore } from './stores/credentials'
import { useSettingsStore } from './stores/settings'
import './styles/reset.css'
import './styles/admin.css'

const pinia = createPinia()
setActivePinia(pinia)
credentialStore.hydrate()
const settings = useSettingsStore()
const router = createAppRouter(deriveBasePathFromModuleUrl(import.meta.url))
const queryClient = createAppQueryClient({
  onUnauthorized() {
    queryClient.clear()
    void router.push('/connect')
  },
})
const app = createApp(App)
app.use(pinia)
app.use(createAppI18n(settings.locale))
app.use(router)
app.use(VueQueryPlugin, { queryClient })
app.mount('#app')
