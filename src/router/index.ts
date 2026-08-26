import { createRouter, createWebHistory } from 'vue-router'
import ConnectionPage from '@/features/connection/ConnectionPage.vue'
import DashboardPage from '@/features/dashboard/DashboardPage.vue'
import NodesPage from '@/features/nodes/NodesPage.vue'
import PreAuthKeysPage from '@/features/preauth-keys/PreAuthKeysPage.vue'
import RoutesPage from '@/features/routes/RoutesPage.vue'
import AppShell from '@/features/shell/AppShell.vue'
import SettingsPage from '@/features/settings/SettingsPage.vue'
import UsersPage from '@/features/users/UsersPage.vue'
import { requireConnection } from '@/router/guards'

export function createAppRouter() {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
      { path: '/connect', component: ConnectionPage },
      {
        path: '/',
        component: AppShell,
        children: [
          { path: '', component: DashboardPage },
          { path: 'users', component: UsersPage },
          { path: 'nodes', component: NodesPage },
          { path: 'routes', component: RoutesPage },
          { path: 'preauth-keys', component: PreAuthKeysPage },
          { path: 'settings', component: SettingsPage },
        ],
      },
    ],
  })
  router.beforeEach(requireConnection)
  return router
}
