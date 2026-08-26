import { createRouter, createWebHistory } from 'vue-router'
import ConnectionPage from '@/features/connection/ConnectionPage.vue'
import AppShell from '@/features/shell/AppShell.vue'
import ConnectedHomePage from '@/features/shell/ConnectedHomePage.vue'
import { requireConnection } from '@/router/guards'

export function createAppRouter() {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
      {
        path: '/connect',
        component: ConnectionPage,
      },
      {
        path: '/',
        component: AppShell,
        children: [{ path: '', component: ConnectedHomePage }],
      },
    ],
  })
  router.beforeEach(requireConnection)
  return router
}
