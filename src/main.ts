import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { createAppI18n } from './i18n'
import { createAppQueryClient } from './query/client'
import { createAppRouter } from './router'
import { credentialStore } from './stores/credentials'
import { useSettingsStore } from './stores/settings'
import './styles/reset.css'

const pinia = createPinia()
setActivePinia(pinia)
credentialStore.hydrate()
const settings = useSettingsStore()
const app = createApp(App)
app.use(pinia)
app.use(createAppI18n(settings.locale))
app.use(createAppRouter())
app.use(VueQueryPlugin, {
  queryClient: createAppQueryClient(),
})
app.mount('#app')
