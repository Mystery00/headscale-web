<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton } from 'naive-ui'
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Database,
  KeyRound,
  Network,
  Route,
  Server,
  Users,
  WifiOff,
} from '@lucide/vue'
import { appVersion } from '@/config/app'
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
const onlineNodes = computed(() => nodes.value.filter((node) => node.online))
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

const kpiCards = computed(() => [
  {
    label: t('dashboard.nodes'),
    value: String(onlineNodes.value.length),
    meta: `/ ${nodes.value.length} ${t('common.online')}`,
    helper:
      offlineNodes.value.length > 0
        ? `${offlineNodes.value.length} ${t('dashboard.offlineNodes')}`
        : `${Math.round((onlineNodes.value.length / (nodes.value.length || 1)) * 100)}% 节点在线`,
    icon: Server,
    tone: offlineNodes.value.length ? ('warning' as const) : ('success' as const),
  },
  {
    label: t('dashboard.users'),
    value: String(usersQuery.data.value?.length ?? 0),
    meta: t('dashboard.users'),
    helper: `${nodes.value.length} 台设备归属管理`,
    icon: Users,
    tone: 'neutral' as const,
  },
  {
    label: t('dashboard.approvedRoutes'),
    value: String(routes.value.filter((route) => route.approved).length),
    meta: `/ ${routes.value.filter((route) => route.advertised).length} ${t('routes.approved')}`,
    helper:
      pendingRoutes.value.length > 0
        ? `${pendingRoutes.value.length} 条通告待审批`
        : '子网路由全部生效运行',
    icon: Route,
    tone: pendingRoutes.value.length ? ('warning' as const) : ('success' as const),
  },
  {
    label: t('dashboard.activeKeys'),
    value: String(keys.value.filter((key) => key.state === 'active').length),
    meta: t('preAuthKeys.active'),
    helper:
      expiringKeys.value.length > 0
        ? `${expiringKeys.value.length} 个密钥即将过期`
        : '无即将过期凭证',
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
          v-for="card in kpiCards"
          :key="card.label"
          :label="card.label"
          :value="card.value"
          :meta="card.meta"
          :helper="card.helper"
          :tone="card.tone"
          :loading="loading"
        >
          <component :is="card.icon" :size="16" />
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
            <div class="network-list__item">
              <dt>
                <Server :size="15" class="network-list__icon" aria-hidden="true" />
                {{ t('shell.version') }}
              </dt>
              <dd>
                <code class="version-badge">{{ versionQuery.data.value?.version ?? '—' }}</code>
              </dd>
            </div>
            <div class="network-list__item">
              <dt>
                <Activity :size="15" class="network-list__icon" aria-hidden="true" />
                控制台版本
              </dt>
              <dd>
                <code class="version-badge">v{{ appVersion }}</code>
              </dd>
            </div>
            <div class="network-list__item">
              <dt>
                <Database :size="15" class="network-list__icon" aria-hidden="true" />
                数据库连通状态
              </dt>
              <dd class="text-success">
                {{ healthQuery.data.value?.databaseConnectivity ? '连通正常 (Healthy)' : '连通异常' }}
              </dd>
            </div>
            <div class="network-list__item">
              <dt>
                <Network :size="15" class="network-list__icon" aria-hidden="true" />
                {{ t('dashboard.advertisedRoutes') }}
              </dt>
              <dd>{{ routes.filter((route) => route.advertised).length }} 条子网</dd>
            </div>
            <div class="network-list__item">
              <dt>
                <Route :size="15" class="network-list__icon" aria-hidden="true" />
                {{ t('dashboard.approvedRoutes') }}
              </dt>
              <dd>{{ routes.filter((route) => route.approved).length }} 条已生效</dd>
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
              :label="hasAttention ? `${offlineNodes.length + pendingRoutes.length} 项需处理` : t('dashboard.allClear')"
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
              <WifiOff :size="16" class="attention-item__icon attention-item__icon--warning" aria-hidden="true" />
              <div class="attention-item__copy">
                <strong>{{ node.givenName || node.name }}</strong>
                <span>{{ node.user.name }} · {{ node.ipAddresses[0] ?? '' }} · {{ t('dashboard.offlineList') }}</span>
              </div>
              <ChevronRight :size="16" class="attention-item__arrow" aria-hidden="true" />
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
              <Route :size="16" class="attention-item__icon attention-item__icon--warning" aria-hidden="true" />
              <div class="attention-item__copy">
                <strong>{{ route.prefix }}</strong>
                <span>{{ route.nodeName }} · {{ t('dashboard.unapprovedRoutes') }}</span>
              </div>
              <ChevronRight :size="16" class="attention-item__arrow" aria-hidden="true" />
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
              <KeyRound :size="16" class="attention-item__icon attention-item__icon--warning" aria-hidden="true" />
              <div class="attention-item__copy">
                <strong>{{ key.keyPreview ?? key.id }}</strong>
                <span>{{ t('dashboard.expiringKeyList') }}</span>
              </div>
              <ChevronRight :size="16" class="attention-item__arrow" aria-hidden="true" />
            </RouterLink>
          </div>

          <div v-else class="all-clear-box">
            <CheckCircle2 :size="32" class="all-clear-icon" aria-hidden="true" />
            <h3>{{ t('dashboard.allClear') }}</h3>
            <p>{{ t('dashboard.allClearHint') }}</p>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}

.dashboard-panel {
  min-width: 0;
  padding: 1.25rem 1.35rem;
  border-radius: var(--admin-radius);
  border: 1px solid var(--admin-border);
  background: var(--admin-surface);
  box-shadow: var(--admin-shadow);
}

.panel-heading {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.15rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--admin-border);
}

.panel-heading h2 {
  margin: 0;
  color: var(--admin-text);
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.panel-heading p {
  margin: 0.25rem 0 0;
  color: var(--admin-muted);
  font-size: 0.78rem;
}

.network-list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

.network-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.85rem;
  border-radius: 6px;
  background: var(--admin-surface-muted);
  border: 1px solid transparent;
  transition: border-color 0.15s ease;
}

.network-list__item:hover {
  border-color: var(--admin-border);
}

.network-list dt {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--admin-muted);
  font-size: 0.82rem;
  font-weight: 500;
}

.network-list__icon {
  color: var(--admin-muted);
}

.network-list dd {
  margin: 0;
  color: var(--admin-text);
  font-size: 0.85rem;
  font-weight: 600;
}

.version-badge {
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: color-mix(in srgb, var(--admin-text) 6%, transparent);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
}

.text-success {
  color: var(--admin-success) !important;
}

.attention-list {
  display: grid;
  gap: 0.5rem;
}

.attention-item {
  color: inherit;
  text-decoration: none;
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--admin-border);
  border-radius: 8px;
  background: var(--admin-surface);
  transition: all 0.15s ease;
}

.attention-item:hover {
  border-color: color-mix(in srgb, var(--admin-primary) 50%, var(--admin-border));
  background: var(--admin-primary-soft);
  transform: translateX(2px);
}

.attention-item__icon {
  flex: 0 0 auto;
}

.attention-item__icon--warning {
  color: var(--admin-warning);
}

.attention-item__copy {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
  flex: 1 1 auto;
}

.attention-item strong {
  overflow: hidden;
  color: var(--admin-text);
  font-size: 0.85rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-item span {
  color: var(--admin-muted);
  font-size: 0.75rem;
}

.attention-item__arrow {
  color: var(--admin-muted);
  opacity: 0.6;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.attention-item:hover .attention-item__arrow {
  transform: translateX(2px);
  opacity: 1;
  color: var(--admin-primary);
}

.all-clear-box {
  display: grid;
  place-items: center;
  text-align: center;
  padding: 2.5rem 1rem;
  gap: 0.35rem;
}

.all-clear-icon {
  color: var(--admin-success);
  margin-bottom: 0.5rem;
}

.all-clear-box h3 {
  margin: 0;
  color: var(--admin-text);
  font-size: 0.95rem;
  font-weight: 600;
}

.all-clear-box p {
  margin: 0;
  color: var(--admin-muted);
  font-size: 0.8rem;
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
