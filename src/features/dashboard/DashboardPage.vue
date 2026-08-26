<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCard, NGrid, NGridItem, NSpin } from 'naive-ui'
import { mapRoutesFromNodes } from '@/mappers/route-mapper'
import {
  useNodesQuery,
  usePreAuthKeysQuery,
  useSystemHealthQuery,
  useSystemVersionQuery,
  useUsersQuery,
} from '@/query/use-headscale-queries'

const { t } = useI18n()
const users = useUsersQuery()
const nodes = useNodesQuery()
const keys = usePreAuthKeysQuery()
const version = useSystemVersionQuery()
const health = useSystemHealthQuery()

const soon = 7 * 24 * 60 * 60 * 1000
const now = computed(() => Date.now())
const routes = computed(() => mapRoutesFromNodes(nodes.data.value ?? []))
const loading = computed(
  () => users.isLoading.value || nodes.isLoading.value || keys.isLoading.value,
)

const cards = computed(() => {
  const nodeList = nodes.data.value ?? []
  const keyList = keys.data.value ?? []
  return [
    { label: t('shell.version'), value: version.data.value?.version ?? '—' },
    {
      label: t('shell.databaseConnected'),
      value: health.data.value?.databaseConnectivity ? t('common.yes') : t('common.no'),
    },
    { label: t('dashboard.users'), value: String(users.data.value?.length ?? 0) },
    { label: t('dashboard.nodes'), value: String(nodeList.length) },
    { label: t('dashboard.onlineNodes'), value: String(nodeList.filter((n) => n.online).length) },
    { label: t('dashboard.offlineNodes'), value: String(nodeList.filter((n) => !n.online).length) },
    {
      label: t('dashboard.advertisedRoutes'),
      value: String(routes.value.filter((r) => r.advertised).length),
    },
    {
      label: t('dashboard.approvedRoutes'),
      value: String(routes.value.filter((r) => r.approved).length),
    },
    {
      label: t('dashboard.activeKeys'),
      value: String(keyList.filter((k) => k.state === 'active').length),
    },
    {
      label: t('dashboard.expiringKeys'),
      value: String(
        keyList.filter(
          (k) => k.state === 'active' && k.expiration && k.expiration.getTime() - now.value <= soon,
        ).length,
      ),
    },
  ]
})
</script>

<template>
  <section>
    <h1>{{ t('dashboard.title') }}</h1>
    <NSpin :show="loading">
      <NGrid cols="2 s:3 m:5" responsive="screen" :x-gap="12" :y-gap="12">
        <NGridItem v-for="card in cards" :key="card.label">
          <NCard size="small">
            <div>{{ card.label }}</div>
            <strong>{{ card.value }}</strong>
          </NCard>
        </NGridItem>
      </NGrid>
    </NSpin>
  </section>
</template>
