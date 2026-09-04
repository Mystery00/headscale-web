<script setup lang="ts">
import { RefreshCw, Server } from '@lucide/vue'
import { NButton, NSelect } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/ui/StatusBadge.vue'
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
const themeOptions = computed(() => [
  { label: t('shell.themeLight'), value: 'light' },
  { label: t('shell.themeDark'), value: 'dark' },
  { label: t('shell.themeSystem'), value: 'system' },
])

const versionLabel = computed(() => versionQuery.data.value?.version ?? '—')
const databaseConnected = computed(() => Boolean(healthQuery.data.value?.databaseConnectivity))
const healthUnavailable = computed(
  () =>
    healthQuery.isError.value ||
    healthQuery.data.value === undefined ||
    healthQuery.data.value.databaseConnectivity === undefined,
)
const databaseLabel = computed(() => {
  if (healthUnavailable.value) return t('common.unavailable')
  return databaseConnected.value ? t('shell.databaseConnected') : t('shell.databaseDisconnected')
})
const databaseTone = computed(() =>
  healthUnavailable.value ? 'neutral' : databaseConnected.value ? 'success' : 'danger',
)
const instanceLabel = computed(() => settings.baseUrl ?? '—')

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
    <div class="status-bar__instance-capsule" :title="instanceLabel">
      <Server :size="13" class="status-bar__instance-icon" aria-hidden="true" />
      <span class="status-bar__instance">{{ instanceLabel }}</span>
    </div>
    <StatusBadge
      :label="versionLabel"
      tone="info"
      :aria-label="`${t('shell.version')}: ${versionLabel}`"
    />
    <StatusBadge :label="databaseLabel" :tone="databaseTone" />
    <NButton size="small" quaternary :aria-label="t('shell.refresh')" class="status-bar__action-btn" @click="refreshAll">
      <template #icon>
        <RefreshCw :size="14" aria-hidden="true" />
      </template>
      <span class="status-bar__refresh-label">{{ t('shell.refresh') }}</span>
    </NButton>
    <NSelect
      size="small"
      class="status-bar__select"
      :value="settings.locale"
      :options="localeOptions"
      :aria-label="t('shell.language')"
      @update:value="onLocale"
    />
    <NSelect
      size="small"
      class="status-bar__select"
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
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  min-width: 0;
}

.status-bar__instance-capsule {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  background: var(--admin-surface-muted);
  border: 1px solid var(--admin-border);
  max-width: 18rem;
}

.status-bar__instance-icon {
  color: var(--admin-muted);
  flex-shrink: 0;
}

.status-bar__instance {
  overflow: hidden;
  color: var(--admin-text);
  font-size: 0.8rem;
  font-weight: 500;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-bar__select {
  width: 7.5rem;
}

.status-bar__refresh-label {
  margin-left: 0.15rem;
}

@media (max-width: 860px) {
  .status-bar__instance-capsule {
    max-width: 10rem;
  }

  .status-bar__select {
    width: 6.5rem;
  }
}

@media (max-width: 640px) {
  .status-bar__refresh-label {
    display: none;
  }
}
</style>
