<script setup lang="ts">
import { NConfigProvider, darkTheme, lightTheme } from 'naive-ui'
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const theme = computed(() => {
  if (settings.theme === 'dark') return darkTheme
  if (settings.theme === 'light') return lightTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? darkTheme : lightTheme
})
</script>

<template>
  <NConfigProvider :theme="theme">
    <router-view />
  </NConfigProvider>
</template>
