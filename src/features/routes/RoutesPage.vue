<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NInput, NSelect, useMessage, useNotification } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { Route as RouteIcon, Search } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import PageToolbar from '@/components/ui/PageToolbar.vue'
import AppDataTable from '@/components/ui/AppDataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useListViewState } from '@/composables/use-list-view-state'
import type { RouteView } from '@/domain/route'
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
const listView = useListViewState({
  filters: {
    q: { queryKey: 'q', defaultValue: '' },
    filter: {
      queryKey: 'filter',
      defaultValue: 'all' as 'all' | 'pending' | 'approved' | 'exit' | 'subnet',
      validate: (value: string): value is 'all' | 'pending' | 'approved' | 'exit' | 'subnet' =>
        ['all', 'pending', 'approved', 'exit', 'subnet'].includes(value),
    },
  },
  sortKeys: ['prefix', 'node', 'advertised', 'approved', 'serving'] as const,
})
const search = listView.filters.q
const filter = listView.filters.filter
const pendingRevoke = ref<RouteView | null>(null)
const routes = computed(() => mapRoutesFromNodes(query.data.value ?? []))
const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return routes.value.filter((route) => {
    const matchesFilter =
      filter.value === 'pending'
        ? route.advertised && !route.approved
        : filter.value === 'approved'
          ? route.approved
          : filter.value === 'exit'
            ? route.exitRoute
            : filter.value === 'subnet'
              ? !route.exitRoute
              : true
    const matchesSearch = !term || `${route.prefix} ${route.nodeName}`.toLowerCase().includes(term)
    return matchesFilter && matchesSearch
  })
})
const pagination = listView.pagination(computed(() => filtered.value.length))
listView.syncFocusPage(filtered)
const options = computed(() => [
  { label: t('routes.filterAll'), value: 'all' },
  { label: t('routes.filterPending'), value: 'pending' },
  { label: t('routes.filterApproved'), value: 'approved' },
  { label: t('routes.filterExit'), value: 'exit' },
  { label: t('routes.filterSubnet'), value: 'subnet' },
])

function badge(value: boolean, positive: string, negative: string) {
  return h(StatusBadge, { label: value ? positive : negative, tone: value ? 'success' : 'neutral' })
}

const columns = computed<DataTableColumns<RouteView>>(() => [
  {
    title: t('routes.prefix'),
    key: 'prefix',
    minWidth: 180,
    sorter: (left, right) => left.prefix.localeCompare(right.prefix),
    sortOrder: listView.sortOrderFor('prefix'),
    render: (route) => h('code', route.prefix),
  },
  {
    title: t('routes.node'),
    key: 'node',
    minWidth: 170,
    sorter: (left, right) => left.nodeName.localeCompare(right.nodeName),
    sortOrder: listView.sortOrderFor('node'),
    render: (route) => route.nodeName,
  },
  {
    title: t('routes.advertised'),
    key: 'advertised',
    width: 130,
    sorter: (left, right) => Number(left.advertised) - Number(right.advertised),
    sortOrder: listView.sortOrderFor('advertised'),
    render: (route) => badge(route.advertised, t('common.yes'), t('common.no')),
  },
  {
    title: t('routes.approved'),
    key: 'approved',
    width: 130,
    sorter: (left, right) => Number(left.approved) - Number(right.approved),
    sortOrder: listView.sortOrderFor('approved'),
    render: (route) => badge(route.approved, t('common.yes'), t('common.no')),
  },
  {
    title: t('routes.serving'),
    key: 'serving',
    width: 130,
    sorter: (left, right) => Number(left.serving) - Number(right.serving),
    sortOrder: listView.sortOrderFor('serving'),
    render: (route) => badge(route.serving, t('common.yes'), t('common.no')),
  },
  {
    title: t('common.details'),
    key: 'actions',
    width: 130,
    render: (route) =>
      h(
        NButton,
        {
          size: 'small',
          type: route.approved ? 'warning' : 'primary',
          secondary: true,
          disabled: locked.value.has(route.nodeId),
          onClick: () => (route.approved ? (pendingRevoke.value = route) : toggle(route, true)),
        },
        { default: () => (route.approved ? t('common.revoke') : t('common.approve')) },
      ),
  },
])

async function setRoutes(nodeId: string, prefixes: string[]) {
  if (locked.value.has(nodeId)) return
  locked.value = new Set(locked.value).add(nodeId)
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

function toggle(route: RouteView, approved: boolean) {
  const node = query.data.value?.find((item) => item.id === route.nodeId)
  if (!node) return
  void setRoutes(node.id, nextApprovedRoutes(node, route.prefix, approved))
}

function confirmRevoke() {
  if (!pendingRevoke.value) return
  const route = pendingRevoke.value
  pendingRevoke.value = null
  toggle(route, false)
}
</script>

<template>
  <section class="admin-page routes-page">
    <PageHeader :title="t('routes.title')" :description="t('routes.description')" />
    <PageToolbar>
      <NInput
        v-model:value="search"
        clearable
        :placeholder="t('common.search')"
        :input-props="{ 'aria-label': t('common.search') }"
        class="search-input"
      >
        <template #prefix><Search :size="17" aria-hidden="true" /></template>
      </NInput>
      <NSelect
        v-model:value="filter"
        :options="options"
        :aria-label="t('common.filter')"
        class="filter-select"
      />
    </PageToolbar>
    <EmptyState v-if="query.isError.value && filtered.length > 0" :title="t('common.error')">
      <template #action>
        <NButton secondary @click="query.refetch()">{{ t('common.retry') }}</NButton>
      </template>
    </EmptyState>

    <AppDataTable
      :columns="columns"
      :data="filtered"
      :loading="query.isLoading.value"
      :row-key="(route) => route.id"
      :aria-label="t('routes.title')"
      :scroll-x="900"
      :pagination="pagination"
      :row-class-name="
        (route: RouteView) => (route.id === listView.focusId.value ? 'is-focused' : '')
      "
      @update:sorter="listView.onSorterChange"
    >
      <template #empty>
        <EmptyState :title="query.isError.value ? t('common.error') : t('common.empty')">
          <template #action>
            <NButton v-if="query.isError.value" secondary @click="query.refetch()">{{
              t('common.retry')
            }}</NButton>
            <RouteIcon v-else :size="20" aria-hidden="true" />
          </template>
        </EmptyState>
      </template>
    </AppDataTable>
    <ConfirmDialog
      :show="Boolean(pendingRevoke)"
      :title="t('routes.revokeTitle')"
      :message="
        t('routes.revokeMessage', {
          prefix: pendingRevoke?.prefix ?? '',
          node: pendingRevoke?.nodeName ?? '',
        })
      "
      :confirm-label="t('common.revoke')"
      danger
      :pending="mutateRoutes.isPending.value"
      @update:show="!$event && (pendingRevoke = null)"
      @confirm="confirmRevoke"
    />
  </section>
</template>

<style scoped>
.search-input {
  width: min(26rem, 100%);
}
.filter-select {
  width: min(16rem, 100%);
}
:deep(code) {
  color: var(--admin-text);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
</style>
