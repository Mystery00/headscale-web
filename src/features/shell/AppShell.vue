<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { LogOut, Menu } from '@lucide/vue'
import { NButton, NDrawer, NLayout, NLayoutContent, NLayoutHeader, NLayoutSider } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import AppNav from '@/features/shell/AppNav.vue'
import StatusBar from '@/features/shell/StatusBar.vue'
import { credentialStore } from '@/stores/credentials'
import { useSettingsStore } from '@/stores/settings'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()
const queryClient = useQueryClient()
const menuOpen = ref(false)
const confirmDisconnect = ref(false)

const isDark = computed(
  () =>
    settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
)
const themeClass = computed(() => (isDark.value ? 'admin-theme-dark' : 'admin-theme-light'))

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

function closeMenu() {
  menuOpen.value = false
}

function disconnect() {
  credentialStore.clear()
  settings.update({ baseUrl: null, credentialPersistence: 'session' })
  queryClient.clear()
  void router.push('/connect')
}
</script>

<template>
  <div class="app-shell" :class="themeClass">
    <NLayout has-sider class="app-shell__layout" position="absolute">
      <NLayoutSider
        class="app-shell__sider"
        bordered
        collapse-mode="width"
        :collapsed-width="0"
        :width="232"
        :native-scrollbar="false"
        content-style="padding: 0;"
      >
        <AppNav @select="closeMenu" />
      </NLayoutSider>
      <NLayout class="app-shell__main-layout">
        <NLayoutHeader bordered class="app-shell__header">
          <div class="app-shell__header-row">
            <NButton
              class="menu-button"
              size="small"
              quaternary
              :aria-label="t('nav.menu')"
              @click="menuOpen = true"
            >
              <template #icon>
                <Menu :size="18" aria-hidden="true" />
              </template>
              <span class="menu-button__label">{{ t('nav.menu') }}</span>
            </NButton>
            <StatusBar />
            <NButton
              class="disconnect-button"
              quaternary
              size="small"
              :aria-label="t('shell.disconnect')"
              @click="confirmDisconnect = true"
            >
              <template #icon>
                <LogOut :size="15" aria-hidden="true" />
              </template>
              {{ t('shell.disconnect') }}
            </NButton>
          </div>
        </NLayoutHeader>
        <NLayoutContent class="app-shell__content" content-style="padding: 0;">
          <main class="admin-content app-shell__page">
            <router-view />
          </main>
        </NLayoutContent>
      </NLayout>
    </NLayout>

    <ConfirmDialog
      v-model:show="confirmDisconnect"
      :title="t('shell.disconnect')"
      :message="t('settings.disconnectMessage')"
      :confirm-label="t('shell.disconnect')"
      danger
      @confirm="disconnect"
    />

    <NDrawer
      v-model:show="menuOpen"
      class="app-shell__drawer"
      :class="themeClass"
      content-class="app-shell__drawer-content"
      placement="left"
      :width="260"
      :aria-label="t('nav.primary')"
    >
      <AppNav @select="closeMenu" />
    </NDrawer>
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100vh;
  color: var(--admin-text);
  background: var(--admin-bg);
}

.app-shell__layout {
  min-height: 100vh;
  background: var(--admin-bg);
}

.app-shell__sider {
  background: var(--admin-sidebar) !important;
  border-right: 1px solid var(--admin-sidebar-border) !important;
}

.app-shell__sider :deep(.n-layout-sider-scroll-container) {
  background: var(--admin-sidebar);
}

.app-shell__main-layout {
  min-width: 0;
  background: var(--admin-bg);
}

.app-shell__header {
  padding: 0.85rem 1rem;
  background: color-mix(in srgb, var(--admin-surface) 92%, transparent);
  backdrop-filter: blur(10px);
}

.app-shell__header-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.app-shell__content {
  background: var(--admin-bg);
}

.app-shell__page {
  box-sizing: border-box;
  min-height: calc(100vh - 4.5rem);
  padding: 1.25rem 1rem 2rem;
}

.menu-button {
  display: none;
}

.disconnect-button {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--admin-muted);
  transition: color 0.15s ease-in-out;
}

.disconnect-button:hover {
  color: var(--admin-danger) !important;
}

@media (max-width: 860px) {
  .app-shell__sider {
    display: none !important;
  }

  .menu-button {
    display: inline-flex;
  }

  .disconnect-button {
    margin-left: 0;
  }
}

@media (max-width: 520px) {
  .menu-button__label {
    display: none;
  }
}
</style>

<style>
/* Teleported drawer leaves the scoped shell root; style it globally by class. */
.n-drawer.app-shell__drawer,
.n-drawer.app-shell__drawer .n-drawer-content-wrapper,
.n-drawer.app-shell__drawer .app-shell__drawer-content {
  color: var(--admin-sidebar-text);
  background: var(--admin-sidebar) !important;
}

.n-drawer.app-shell__drawer .app-shell__drawer-content {
  box-sizing: border-box;
  height: 100%;
  padding: 0;
}
</style>
