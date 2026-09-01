<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton } from 'naive-ui'
import {
  Activity,
  Database,
  KeyRound,
  Network,
  Route,
  Server,
  Users,
  Wifi,
  WifiOff,
} from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { mapRoutesFromNodes } from '@/mappers/route-mapper'
import {
  useNodesQuery,
  usePreAuthKeysQuery,
  useSystemHealthQuery,
  useSystemVersionQuery,
  useUsersQuery,
} from '@/query/use-headscale-queries'

const { t } = useI18n()
const usersQuery = useUsersQuery()
const nodesQuery = useNodesQuery()
const keysQuery = usePreAuthKeysQuery()
const versionQuery = useSystemVersionQuery()
const healthQuery = useSystemHealthQuery()

const soon = 7 * 24 * 60 * 60 * 1000
const now = computed(() => Date.now())
const nodes = computed(() => nodesQuery.data.value ?? [])
const keys = computed(() => keysQuery.data.value ?? [])
const routes = computed(() => mapRoutesFromNodes(nodes.value))
const loading = computed(
  () =>
    usersQuery.isLoading.value ||
    nodesQuery.isLoading.value ||
    keysQuery.isLoading.value ||
    versionQuery.isLoading.value ||
    healthQuery.isLoading.value,
)
const healthUnavailable = computed(
  () =>
    healthQuery.isError.value ||
    healthQuery.data.value === undefined ||
    healthQuery.data.value.databaseConnectivity === undefined,
)
const hasError = computed(
  () =>
    usersQuery.isError.value ||
    nodesQuery.isError.value ||
    keysQuery.isError.value ||
    versionQuery.isError.value ||
    healthQuery.isError.value,
)

function retry() {
  void Promise.all([
    usersQuery.refetch(),
    nodesQuery.refetch(),
    keysQuery.refetch(),
    versionQuery.refetch(),
    healthQuery.refetch(),
  ])
}
const offlineNodes = computed(() => nodes.value.filter((node) => !node.online))
const expiringNodes = computed(() =>
  nodes.value.filter(
    (node) =>
      node.expiry &&
      node.expiry.getTime() >= now.value &&
      node.expiry.getTime() - now.value <= soon,
  ),
)
const expiringKeys = computed(() =>
  keys.value.filter(
    (key) =>
      key.state === 'active' &&
      key.expiration &&
      key.expiration.getTime() >= now.value &&
      key.expiration.getTime() - now.value <= soon,
  ),
)
const pendingRoutes = computed(() =>
  routes.value.filter((route) => route.advertised && !route.approved),
)
const hasAttention = computed(
  () =>
    offlineNodes.value.length > 0 ||
    expiringNodes.value.length > 0 ||
    expiringKeys.value.length > 0 ||
    pendingRoutes.value.length > 0,
)

const cards = computed(() => [
  {
    label: t('shell.version'),
    value: versionQuery.data.value?.version ?? '—',
    icon: Server,
    tone: 'info' as const,
  },
  {
    label: t('shell.databaseConnected'),
    value: healthUnavailable.value
      ? t('common.unavailable')
      : healthQuery.data.value?.databaseConnectivity
        ? t('common.yes')
        : t('common.no'),
    icon: Database,
    tone: healthUnavailable.value
      ? ('neutral' as const)
      : healthQuery.data.value?.databaseConnectivity
        ? ('success' as const)
        : ('danger' as const),
  },
  { label: t('dashboard.users'), value: String(usersQuery.data.value?.length ?? 0), icon: Users },
  { label: t('dashboard.nodes'), value: String(nodes.value.length), icon: Network },
  {
    label: t('dashboard.onlineNodes'),
    value: String(nodes.value.filter((node) => node.online).length),
    icon: Wifi,
    tone: 'success' as const,
  },
  {
    label: t('dashboard.offlineNodes'),
    value: String(offlineNodes.value.length),
    icon: WifiOff,
    tone: offlineNodes.value.length ? ('warning' as const) : ('neutral' as const),
  },
  {
    label: t('dashboard.advertisedRoutes'),
    value: String(routes.value.filter((route) => route.advertised).length),
    icon: Route,
  },
  {
    label: t('dashboard.approvedRoutes'),
    value: String(routes.value.filter((route) => route.approved).length),
    icon: Activity,
    tone: 'success' as const,
  },
  {
    label: t('dashboard.activeKeys'),
    value: String(keys.value.filter((key) => key.state === 'active').length),
    icon: KeyRound,
  },
  {
    label: t('dashboard.expiringKeys'),
    value: String(expiringKeys.value.length),
    icon: KeyRound,
    tone: expiringKeys.value.length ? ('warning' as const) : ('neutral' as const),
  },
])
</script>

<template>
  <section class="admin-page dashboard-page">
    <PageHeader :title="t('dashboard.title')" :description="t('dashboard.description')" />

    <EmptyState v-if="hasError" :title="t('common.error')">
      <template #action
        ><NButton secondary @click="retry">{{ t('common.retry') }}</NButton></template
      >
    </EmptyState>

    <template v-else>
      <div class="stats-grid" aria-label="Dashboard metrics">
        <StatCard
          v-for="card in cards"
          :key="card.label"
          :label="card.label"
          :value="card.value"
          :tone="card.tone"
          :loading="loading"
        >
          <component :is="card.icon" :size="18" />
        </StatCard>
      </div>

      <div class="dashboard-grid">
        <section
          class="admin-card dashboard-panel"
          role="region"
          :aria-label="t('dashboard.networkOverview')"
        >
          <header class="panel-heading">
            <div>
              <h2>{{ t('dashboard.networkOverview') }}</h2>
              <p>{{ t('dashboard.networkOverviewHint') }}</p>
            </div>
            <StatusBadge
              :label="
                healthUnavailable
                  ? t('common.unavailable')
                  : healthQuery.data.value?.databaseConnectivity
                    ? t('shell.databaseConnected')
                    : t('shell.databaseDisconnected')
              "
              :tone="
                healthUnavailable
                  ? 'neutral'
                  : healthQuery.data.value?.databaseConnectivity
                    ? 'success'
                    : 'danger'
              "
            />
          </header>
          <dl class="network-list">
            <div>
              <dt>{{ t('shell.version') }}</dt>
              <dd>{{ versionQuery.data.value?.version ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ t('dashboard.advertisedRoutes') }}</dt>
              <dd>{{ routes.filter((route) => route.advertised).length }}</dd>
            </div>
            <div>
              <dt>{{ t('dashboard.approvedRoutes') }}</dt>
              <dd>{{ routes.filter((route) => route.approved).length }}</dd>
            </div>
          </dl>
        </section>

        <section
          class="admin-card dashboard-panel"
          role="region"
          :aria-label="t('dashboard.needsAttention')"
        >
          <header class="panel-heading">
            <div>
              <h2>{{ t('dashboard.needsAttention') }}</h2>
              <p>{{ t('dashboard.needsAttentionHint') }}</p>
            </div>
            <StatusBadge
              :label="hasAttention ? t('dashboard.attentionRequired') : t('dashboard.allClear')"
              :tone="hasAttention ? 'warning' : 'success'"
            />
          </header>

          <div v-if="hasAttention" class="attention-list">
            <RouterLink
              v-for="node in offlineNodes"
              :key="`offline-${node.id}`"
              class="attention-item"
              :to="{
                path: '/nodes',
                query: { status: 'offline', q: node.givenName || node.name, focus: node.id },
              }"
            >
              <WifiOff :size="18" aria-hidden="true" />
              <div>
                <strong>{{ node.givenName || node.name }}</strong
                ><span>{{ t('dashboard.offlineList') }}</span>
              </div>
            </RouterLink>
            <RouterLink
              v-for="node in expiringNodes"
              :key="`expiry-${node.id}`"
              class="attention-item"
              :to="{
                path: '/nodes',
                query: { q: node.givenName || node.name, focus: node.id },
              }"
            >
              <Activity :size="18" aria-hidden="true" />
              <div>
                <strong>{{ node.givenName || node.name }}</strong
                ><span>{{ t('dashboard.expiringNodes') }}</span>
              </div>
            </RouterLink>
            <RouterLink
              v-for="key in expiringKeys"
              :key="`key-${key.id}`"
              class="attention-item"
              :to="{
                path: '/preauth-keys',
                query: { state: 'active', q: key.keyPreview ?? key.id, focus: key.id },
              }"
            >
              <KeyRound :size="18" aria-hidden="true" />
              <div>
                <strong>{{ key.keyPreview ?? key.id }}</strong
                ><span>{{ t('dashboard.expiringKeyList') }}</span>
              </div>
            </RouterLink>
            <RouterLink
              v-for="route in pendingRoutes"
              :key="route.id"
              class="attention-item"
              :to="{
                path: '/routes',
                query: { filter: 'pending', q: route.prefix, focus: route.id },
              }"
            >
              <Route :size="18" aria-hidden="true" />
              <div>
                <strong>{{ route.prefix }}</strong
                ><span>{{ route.nodeName }} · {{ t('dashboard.unapprovedRoutes') }}</span>
              </div>
            </RouterLink>
          </div>
          <EmptyState
            v-else
            :title="t('dashboard.allClear')"
            :description="t('dashboard.allClearHint')"
          />
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.85rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.dashboard-panel {
  min-width: 0;
  padding: 1.15rem;
}

.panel-heading {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.panel-heading h2 {
  margin: 0;
  color: var(--admin-text);
  font-size: 1rem;
}

.panel-heading p {
  margin: 0.3rem 0 0;
  color: var(--admin-muted);
  font-size: 0.78rem;
}

.network-list {
  display: grid;
  gap: 0.65rem;
  margin: 0;
}

.network-list div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: var(--admin-surface-muted);
}

.network-list dt {
  color: var(--admin-muted);
  font-size: 0.8rem;
}
.network-list dd {
  margin: 0;
  color: var(--admin-text);
  font-weight: 700;
}

.attention-list {
  display: grid;
  gap: 0.65rem;
}
.attention-item {
  color: inherit;
  text-decoration: none;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid var(--admin-border);
  border-radius: 0.75rem;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.attention-item:hover {
  border-color: color-mix(in srgb, var(--admin-primary) 45%, var(--admin-border));
  background: var(--admin-primary-soft);
}
.attention-item:focus-visible {
  outline: 2px solid var(--admin-primary);
  outline-offset: 2px;
}
.attention-item svg {
  flex: 0 0 auto;
  color: var(--admin-warning);
}
.attention-item div {
  display: grid;
  min-width: 0;
}
.attention-item strong {
  overflow: hidden;
  color: var(--admin-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attention-item span {
  color: var(--admin-muted);
  font-size: 0.75rem;
}

@media (max-width: 1050px) {
  .stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .stats-grid,
  .dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dashboard-panel {
    grid-column: 1 / -1;
  }
}
@media (max-width: 460px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
