<script setup lang="ts">
import {
  NConfigProvider,
  NDialogProvider,
  NMessageProvider,
  NNotificationProvider,
  darkTheme,
  lightTheme,
} from 'naive-ui'
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const isDark = computed(
  () =>
    settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
)
const theme = computed(() => (isDark.value ? darkTheme : lightTheme))
const adminThemeClass = computed(() => (isDark.value ? 'admin-theme-dark' : 'admin-theme-light'))
</script>

<template>
  <div class="app-root" :class="adminThemeClass">
    <NConfigProvider :theme="theme">
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
