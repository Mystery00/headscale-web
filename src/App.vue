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
          bodyColor: '#08111d',
          cardColor: '#0f1b2a',
          modalColor: '#0f1b2a',
          popoverColor: '#0f1b2a',
          tableColor: '#0f1b2a',
          tableHeaderColor: '#132235',
          inputColor: '#132235',
          inputColorDisabled: '#101c2b',
          actionColor: '#132235',
          codeColor: '#091522',
          hoverColor: 'rgba(53, 208, 163, 0.1)',
          pressedColor: 'rgba(53, 208, 163, 0.16)',
          borderColor: '#25364b',
          dividerColor: '#25364b',
          textColor1: '#edf5f7',
          textColor2: '#cbd5e1',
          textColor3: '#94a3b8',
          placeholderColor: '#7f8fa4',
          opacityDisabled: '0.62',
        },
      }
    : {},
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
