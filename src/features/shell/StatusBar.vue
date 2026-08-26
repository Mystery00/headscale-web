<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NButton, NSelect } from 'naive-ui'
import {
  useRefreshAll,
  useSystemHealthQuery,
  useSystemVersionQuery,
} from '@/query/use-headscale-queries'
import { useSettingsStore, type LocaleCode, type ThemePreference } from '@/stores/settings'

const { t } = useI18n()
const settings = useSettingsStore()
const versionQuery = useSystemVersionQuery()
const healthQuery = useSystemHealthQuery()
const refreshAll = useRefreshAll()

const localeOptions = [
  { label: 'English', value: 'en-US' },
  { label: '中文', value: 'zh-CN' },
]
const themeOptions = [
  { label: t('shell.themeLight'), value: 'light' },
  { label: t('shell.themeDark'), value: 'dark' },
  { label: t('shell.themeSystem'), value: 'system' },
]

function onLocale(value: LocaleCode) {
  settings.update({ locale: value })
  location.reload()
}

function onTheme(value: ThemePreference) {
  settings.update({ theme: value })
}
</script>

<template>
  <div class="status-bar">
    <span>{{ settings.baseUrl }}</span>
    <span>{{ t('shell.version') }}: {{ versionQuery.data.value?.version ?? '—' }}</span>
    <span>
      {{
        healthQuery.data.value?.databaseConnectivity
          ? t('shell.databaseConnected')
          : t('shell.databaseDisconnected')
      }}
    </span>
    <NButton size="small" :aria-label="t('shell.refresh')" @click="refreshAll">
      {{ t('shell.refresh') }}
    </NButton>
    <NSelect
      size="small"
      style="width: 8rem"
      :value="settings.locale"
      :options="localeOptions"
      :aria-label="t('shell.language')"
      @update:value="onLocale"
    />
    <NSelect
      size="small"
      style="width: 8rem"
      :value="settings.theme"
      :options="themeOptions"
      :aria-label="t('shell.theme')"
      @update:value="onTheme"
    />
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
</style>
