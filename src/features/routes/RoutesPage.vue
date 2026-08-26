<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NButton, NSelect, NSpin, useMessage, useNotification } from 'naive-ui'
import { nextApprovedRoutes } from '@/domain/route-approval'
import { mapRoutesFromNodes } from '@/mappers/route-mapper'
import { useNodesQuery } from '@/query/use-headscale-queries'
import { useSetApprovedRoutesMutation } from '@/query/use-headscale-mutations'

const { t } = useI18n()
const message = useMessage()
const notification = useNotification()
const query = useNodesQuery()
const mutateRoutes = useSetApprovedRoutesMutation()
const locked = ref(new Set<string>())
const filter = ref<'all' | 'pending' | 'approved' | 'exit' | 'subnet'>('all')
const routes = computed(() => mapRoutesFromNodes(query.data.value ?? []))
const filtered = computed(() =>
  routes.value.filter((route) => {
    if (filter.value === 'pending') return route.advertised && !route.approved
    if (filter.value === 'approved') return route.approved
    if (filter.value === 'exit') return route.exitRoute
    if (filter.value === 'subnet') return !route.exitRoute
    return true
  }),
)
const options = computed(() => [
  { label: t('routes.filterAll'), value: 'all' },
  { label: t('routes.filterPending'), value: 'pending' },
  { label: t('routes.filterApproved'), value: 'approved' },
  { label: t('routes.filterExit'), value: 'exit' },
  { label: t('routes.filterSubnet'), value: 'subnet' },
])

async function setRoutes(nodeId: string, prefixes: string[]) {
  if (locked.value.has(nodeId)) return
  const next = new Set(locked.value)
  next.add(nodeId)
  locked.value = next
  try {
    await mutateRoutes.mutateAsync({ nodeId, routes: prefixes })
    message.success(t('common.success'))
  } catch {
    notification.error({ title: t('common.failed') })
  } finally {
    const done = new Set(locked.value)
    done.delete(nodeId)
    locked.value = done
  }
}

function toggle(route: (typeof routes.value)[number], approved: boolean) {
  const node = query.data.value?.find((item) => item.id === route.nodeId)
  if (!node) return
  void setRoutes(node.id, nextApprovedRoutes(node, route.prefix, approved))
}
</script>

<template>
  <section>
    <h1>{{ t('routes.title') }}</h1>
    <NSelect v-model:value="filter" :options="options" :aria-label="t('common.filter')" style="max-width: 16rem" />
    <NAlert v-if="query.isError.value" type="error">{{ t('common.error') }}</NAlert>
    <NSpin :show="query.isLoading.value">
      <p v-if="!query.isLoading.value && filtered.length === 0">{{ t('common.empty') }}</p>
      <table v-else>
        <thead>
          <tr>
            <th>{{ t('routes.prefix') }}</th>
            <th>{{ t('routes.node') }}</th>
            <th>{{ t('routes.advertised') }}</th>
            <th>{{ t('routes.approved') }}</th>
            <th>{{ t('routes.serving') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="route in filtered" :key="route.id">
            <td>{{ route.prefix }}</td>
            <td>{{ route.nodeName }}</td>
            <td>{{ route.advertised ? t('common.yes') : t('common.no') }}</td>
            <td>{{ route.approved ? t('common.yes') : t('common.no') }}</td>
            <td>{{ route.serving ? t('common.yes') : t('common.no') }}</td>
            <td>
              <NButton size="small" :disabled="locked.has(route.nodeId)" @click="toggle(route, !route.approved)">
                {{ route.approved ? t('common.revoke') : t('common.approve') }}
              </NButton>
            </td>
          </tr>
        </tbody>
      </table>
    </NSpin>
  </section>
</template>
