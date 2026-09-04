<script setup lang="ts">
import {
  NConfigProvider,
  NDialogProvider,
  NMessageProvider,
  NNotificationProvider,
  darkTheme,
  lightTheme,
  type GlobalThemeOverrides,
} from 'naive-ui'
import { computed, onBeforeUnmount, watchEffect } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const isDark = computed(
  () =>
    settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
)
const theme = computed(() => (isDark.value ? darkTheme : lightTheme))
const adminThemeClass = computed(() => (isDark.value ? 'admin-theme-dark' : 'admin-theme-light'))
const themeOverrides = computed<GlobalThemeOverrides>(() =>
  isDark.value
    ? {
        common: {
          primaryColor: '#2dd4bf',
          primaryColorHover: '#5eead4',
          primaryColorPressed: '#14b8a6',
          primaryColorSuppl: '#0f766e',
          bodyColor: '#090d16',
          cardColor: '#111726',
          modalColor: '#111726',
          popoverColor: '#111726',
          tableColor: '#111726',
          tableHeaderColor: '#182236',
          inputColor: '#182236',
          inputColorDisabled: '#111726',
          actionColor: '#182236',
          codeColor: '#0c121e',
          hoverColor: 'rgba(45, 212, 191, 0.08)',
          pressedColor: 'rgba(45, 212, 191, 0.14)',
          borderColor: '#232f45',
          dividerColor: '#232f45',
          textColor1: '#f1f5f9',
          textColor2: '#cbd5e1',
          textColor3: '#94a3b8',
          placeholderColor: '#64748b',
          borderRadius: '8px',
          opacityDisabled: '0.5',
        },
      }
    : {
        common: {
          primaryColor: '#0f9f78',
          primaryColorHover: '#12b88b',
          primaryColorPressed: '#0c8564',
          primaryColorSuppl: '#10b981',
          borderRadius: '8px',
          borderColor: '#e2e8f0',
        },
      },
)

watchEffect(() => {
  document.body.classList.remove('admin-theme-dark', 'admin-theme-light')
  document.body.classList.add(adminThemeClass.value)
})

onBeforeUnmount(() => {
  document.body.classList.remove('admin-theme-dark', 'admin-theme-light')
})
</script>

<template>
  <div class="app-root" :class="adminThemeClass">
    <NConfigProvider :theme="theme" :theme-overrides="themeOverrides">
      <NMessageProvider>
        <NNotificationProvider>
          <NDialogProvider>
            <router-view />
          </NDialogProvider>
        </NNotificationProvider>
      </NMessageProvider>
    </NConfigProvider>
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100%;
  color: var(--admin-text);
  background: var(--admin-bg);
}
</style>
