<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NInput,
  NSelect,
  NSpace,
  NTag,
  useMessage,
  useNotification,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { AlertTriangle, Copy, KeyRound, Search, Server, Tags } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import PageToolbar from '@/components/ui/PageToolbar.vue'
import AppDataTable from '@/components/ui/AppDataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import AuthRequestDialog from '@/features/auth/AuthRequestDialog.vue'
import { useMaskedKey } from '@/composables/use-masked-key'
import { useListViewState } from '@/composables/use-list-view-state'
import { formatDateTime } from '@/domain/datetime'
import type { Node } from '@/domain/node'
import { normalizeTags } from '@/domain/tags'
import { useNodesQuery, useUsersQuery } from '@/query/use-headscale-queries'
import { useSettingsStore } from '@/stores/settings'
import {
  useDeleteNodeMutation,
  useExpireNodeNowMutation,
  useRenameNodeMutation,
  useSetNodeTagsMutation,
} from '@/query/use-headscale-mutations'

const { t } = useI18n()
const { mask } = useMaskedKey()
const message = useMessage()
const notification = useNotification()
const settings = useSettingsStore()
const query = useNodesQuery()
const users = useUsersQuery()
const renameNode = useRenameNodeMutation()
const setTags = useSetNodeTagsMutation()
const expireNow = useExpireNodeNowMutation()
const deleteNode = useDeleteNodeMutation()

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text).then(() => {
    message.success(t('common.copied', '已复制到剪贴板'))
  })
}
const listView = useListViewState({
  filters: {
    q: { queryKey: 'q', defaultValue: '' },
    status: {
      queryKey: 'status',
      defaultValue: 'all' as 'all' | 'online' | 'offline',
      validate: (value: string): value is 'all' | 'online' | 'offline' =>
        value === 'all' || value === 'online' || value === 'offline',
    },
    ownerId: { queryKey: 'userId', defaultValue: '' },
  },
  sortKeys: ['status', 'name', 'user', 'lastSeen'] as const,
})
const search = listView.filters.q
const status = listView.filters.status
const ownerId = listView.filters.ownerId
const selected = ref<Node | null>(null)
const renameValue = ref('')
const tagsValue = ref('')
const confirmExpire = ref(false)
const confirmDelete = ref(false)
const showAuthRequest = ref(false)

const statusOptions = computed(() => [
  { label: t('nodes.allStatuses'), value: 'all' },
  { label: t('common.online'), value: 'online' },
  { label: t('common.offline'), value: 'offline' },
])
const ownerOptions = computed(() => {
  const owners = new Map<string, string>()
  for (const user of users.data.value ?? []) owners.set(user.id, user.name)
  for (const node of query.data.value ?? []) {
    if (!owners.has(node.user.id)) owners.set(node.user.id, node.user.name)
  }
  return [
    { label: t('nodes.allUsers'), value: '' },
    ...[...owners.entries()]
      .sort((left, right) => left[1].localeCompare(right[1]))
      .map(([value, label]) => ({ label, value })),
  ]
})

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (query.data.value ?? []).filter((node) => {
    const matchesStatus =
      status.value === 'all' ||
      (status.value === 'online' && node.online) ||
      (status.value === 'offline' && !node.online)
    const matchesOwner = !ownerId.value || node.user.id === ownerId.value
    const haystack =
      `${node.givenName} ${node.name} ${node.user.name} ${node.ipAddresses.join(' ')} ${node.tags.join(' ')}`.toLowerCase()
    return matchesStatus && matchesOwner && (!term || haystack.includes(term))
  })
})
const pagination = listView.pagination(computed(() => filtered.value.length))
listView.syncFocusPage(filtered)

function formatDate(date: Date | null) {
  return formatDateTime(date, { locale: settings.locale, style: settings.dateTimeStyle })
}

function open(node: Node) {
  selected.value = node
  renameValue.value = node.givenName || node.name
  tagsValue.value = node.tags.join(', ')
}

function routeCount(node: Node) {
  return new Set([...node.availableRoutes, ...node.approvedRoutes]).size
}

const columns = computed<DataTableColumns<Node>>(() => [
  {
    title: t('nodes.status'),
    key: 'status',
    width: 110,
    sorter: (left, right) => Number(left.online) - Number(right.online),
    sortOrder: listView.sortOrderFor('status'),
    render: (node) =>
      h(StatusBadge, {
        label: node.online ? t('common.online') : t('common.offline'),
        tone: node.online ? 'success' : 'neutral',
      }),
  },
  {
    title: t('nodes.name'),
    key: 'name',
    minWidth: 180,
    sorter: (left, right) =>
      (left.givenName || left.name).localeCompare(right.givenName || right.name),
    sortOrder: listView.sortOrderFor('name'),
    render: (node) => h('strong', { class: 'node-name' }, node.givenName || node.name),
  },
  {
    title: t('nodes.user'),
    key: 'user',
    width: 130,
    sorter: (left, right) => left.user.name.localeCompare(right.user.name),
    sortOrder: listView.sortOrderFor('user'),
    render: (node) => node.user.name,
  },
  {
    title: t('nodes.ip'),
    key: 'ip',
    minWidth: 190,
    render: (node) =>
      h(
        NSpace,
        { size: 4, wrap: true },
        {
          default: () =>
            [...new Set(node.ipAddresses)].map((ip) =>
              h(
                NTag,
                { key: ip, size: 'small', bordered: false, round: true, class: 'ip-chip' },
                { default: () => ip },
              ),
            ),
        },
      ),
  },
  {
    title: t('nodes.tags'),
    key: 'tags',
    minWidth: 170,
    render: (node) =>
      node.tags.length
        ? h(
            NSpace,
            { size: 4, wrap: true },
            {
              default: () =>
                node.tags.map((tag) =>
                  h(NTag, { key: tag, size: 'small', bordered: false }, { default: () => tag }),
                ),
            },
          )
        : '—',
  },
  {
    title: t('nodes.routes'),
    key: 'routes',
    width: 90,
    render: (node) => String(routeCount(node)),
  },
  {
    title: t('nodes.lastSeen'),
    key: 'lastSeen',
    width: 170,
    sorter: (left, right) => (left.lastSeen?.getTime() ?? 0) - (right.lastSeen?.getTime() ?? 0),
    sortOrder: listView.sortOrderFor('lastSeen'),
    render: (node) => formatDate(node.lastSeen),
  },
  {
    title: t('nodes.expiry'),
    key: 'expiry',
    width: 170,
    render: (node) => formatDate(node.expiry),
  },
  {
    title: t('common.details'),
    key: 'actions',
    width: 90,
    fixed: 'right',
    render: (node) =>
      h(
        NButton,
        { size: 'small', quaternary: true, onClick: () => open(node) },
        { default: () => t('common.details') },
      ),
  },
])

async function run(action: () => Promise<unknown>, onSuccess?: () => void) {
  try {
    await action()
    message.success(t('common.success'))
    onSuccess?.()
  } catch {
    notification.error({ title: t('common.failed') })
  }
}

function onRename() {
  if (!selected.value) return
  void run(() =>
    renameNode.mutateAsync({ nodeId: selected.value!.id, newName: renameValue.value.trim() }),
  )
}

function onSetTags() {
  if (!selected.value) return
  void run(() =>
    setTags.mutateAsync({
      nodeId: selected.value!.id,
      tags: normalizeTags(tagsValue.value.split(',')),
    }),
  )
}

function onExpire() {
  if (!selected.value) return
  void run(
    () => expireNow.mutateAsync(selected.value!.id),
    () => {
      confirmExpire.value = false
    },
  )
}

function onDelete() {
  if (!selected.value) return
  void run(
    () => deleteNode.mutateAsync(selected.value!.id),
    () => {
      confirmDelete.value = false
      selected.value = null
    },
  )
}
</script>

<template>
  <section class="admin-page nodes-page">
    <PageHeader :title="t('nodes.title')" :description="t('nodes.description')">
      <template #actions>
        <NButton type="primary" @click="showAuthRequest = true">
          {{ t('authRequests.manualAction') }}
        </NButton>
      </template>
    </PageHeader>

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
        v-model:value="status"
        :options="statusOptions"
        :aria-label="t('nodes.status')"
        class="status-select"
      />
      <NSelect
        v-model:value="ownerId"
        :options="ownerOptions"
        :aria-label="t('nodes.owner')"
        class="owner-select"
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
      :row-key="(node) => node.id"
      :aria-label="t('nodes.title')"
      :scroll-x="1350"
      :pagination="pagination"
      :row-class-name="(node: Node) => (node.id === listView.focusId.value ? 'is-focused' : '')"
      @update:sorter="listView.onSorterChange"
    >
      <template #empty>
        <EmptyState :title="query.isError.value ? t('common.error') : t('common.empty')">
          <template v-if="query.isError.value" #action>
            <NButton secondary @click="query.refetch()">{{ t('common.retry') }}</NButton>
          </template>
        </EmptyState>
      </template>
    </AppDataTable>

    <NDrawer
      :show="Boolean(selected)"
      width="min(460px, calc(100vw - 16px))"
      @update:show="(value: boolean) => !value && (selected = null)"
    >
      <NDrawerContent v-if="selected" :title="selected.givenName || selected.name" closable>
        <div class="drawer-stack">
          <section class="drawer-section">
            <h2 class="drawer-section__title"><Server :size="16" aria-hidden="true" />{{ t('nodes.overview') }}</h2>
            <dl class="drawer-dl">
              <div>
                <dt>{{ t('nodes.status') }}</dt>
                <dd>
                  <StatusBadge
                    :label="selected.online ? t('common.online') : t('common.offline')"
                    :tone="selected.online ? 'success' : 'neutral'"
                  />
                </dd>
              </div>
              <div>
                <dt>{{ t('nodes.user') }}</dt>
                <dd>{{ selected.user.name }}</dd>
              </div>
              <div>
                <dt>{{ t('nodes.registerMethod') }}</dt>
                <dd><span class="method-tag">{{ selected.registerMethod }}</span></dd>
              </div>
              <div>
                <dt>{{ t('nodes.createdAt') }}</dt>
                <dd>{{ formatDate(selected.createdAt) }}</dd>
              </div>
            </dl>
          </section>

          <section class="drawer-section">
            <h2 class="drawer-section__title"><KeyRound :size="16" aria-hidden="true" />{{ t('nodes.keys') }}</h2>
            <div class="key-item">
              <span class="key-label">{{ t('nodes.machineKey') }}</span>
              <div class="key-val">
                <code>{{ mask(selected.machineKey) }}</code>
                <NButton size="tiny" quaternary :aria-label="t('common.copy', '复制')" @click="copyToClipboard(selected.machineKey)">
                  <template #icon><Copy :size="13" /></template>
                </NButton>
              </div>
            </div>
            <div class="key-item">
              <span class="key-label">{{ t('nodes.nodeKey') }}</span>
              <div class="key-val">
                <code>{{ mask(selected.nodeKey) }}</code>
                <NButton size="tiny" quaternary :aria-label="t('common.copy', '复制')" @click="copyToClipboard(selected.nodeKey)">
                  <template #icon><Copy :size="13" /></template>
                </NButton>
              </div>
            </div>
            <div class="key-item">
              <span class="key-label">{{ t('nodes.discoKey') }}</span>
              <div class="key-val">
                <code>{{ mask(selected.discoKey) }}</code>
                <NButton size="tiny" quaternary :aria-label="t('common.copy', '复制')" @click="copyToClipboard(selected.discoKey)">
                  <template #icon><Copy :size="13" /></template>
                </NButton>
              </div>
            </div>
          </section>

          <section class="drawer-section">
            <h2 class="drawer-section__title">{{ t('common.rename') }}</h2>
            <div class="form-row">
              <NInput
                v-model:value="renameValue"
                :input-props="{ 'aria-label': t('common.rename') }"
              />
              <NButton
                :loading="renameNode.isPending.value"
                :disabled="!renameValue.trim()"
                @click="onRename"
                >{{ t('common.rename') }}</NButton
              >
            </div>
          </section>

          <section class="drawer-section">
            <h2 class="drawer-section__title"><Tags :size="16" aria-hidden="true" />{{ t('nodes.setTags') }}</h2>
            <div class="form-row">
              <NInput
                v-model:value="tagsValue"
                :input-props="{ 'aria-label': t('nodes.setTags') }"
                :placeholder="t('nodes.tagsPlaceholder')"
              />
              <NButton :loading="setTags.isPending.value" @click="onSetTags">{{
                t('nodes.setTags')
              }}</NButton>
            </div>
          </section>

          <section class="drawer-section danger-zone">
            <h2 class="drawer-section__title text-danger">
              <AlertTriangle :size="16" aria-hidden="true" />{{ t('nodes.dangerZone') }}
            </h2>
            <p class="danger-desc">以下操作直接影响设备网络连通，请谨慎执行。</p>
            <div class="danger-actions">
              <NButton type="warning" secondary @click="confirmExpire = true">{{
                t('nodes.expireNow')
              }}</NButton>
              <NButton type="error" secondary @click="confirmDelete = true">{{
                t('common.delete')
              }}</NButton>
            </div>
          </section>
        </div>
      </NDrawerContent>
    </NDrawer>

    <AuthRequestDialog v-model:show="showAuthRequest" />

    <ConfirmDialog
      v-if="selected"
      v-model:show="confirmExpire"
      :title="t('nodes.expireTitle')"
      :message="t('nodes.expireMessage', { name: selected.givenName || selected.name })"
      :confirm-label="t('nodes.expireNow')"
      danger
      :pending="expireNow.isPending.value"
      @confirm="onExpire"
    />
    <ConfirmDialog
      v-if="selected"
      v-model:show="confirmDelete"
      :title="t('nodes.deleteTitle')"
      :message="t('nodes.deleteMessage', { name: selected.givenName || selected.name })"
      :confirm-label="t('nodes.confirmDelete')"
      danger
      :pending="deleteNode.isPending.value"
      @confirm="onDelete"
    />
  </section>
</template>

<style scoped>
.search-input {
  width: min(25rem, 100%);
}
.status-select {
  width: min(12rem, 100%);
}
.owner-select {
  width: min(14rem, 100%);
}
.node-name {
  color: var(--admin-text);
  font-weight: 600;
}
:deep(.ip-chip) {
  color: var(--admin-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
  background: var(--admin-surface-muted);
}
.drawer-stack {
  display: grid;
  gap: 1.25rem;
  padding: 0.25rem 0;
}
.drawer-section {
  display: grid;
  gap: 0.75rem;
  padding-bottom: 1.15rem;
  border-bottom: 1px solid var(--admin-border);
}
.drawer-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.drawer-section__title {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  margin: 0;
  color: var(--admin-text);
  font-size: 0.88rem;
  font-weight: 600;
}
.drawer-dl {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}
.drawer-dl div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0;
}
.drawer-dl dt {
  color: var(--admin-muted);
  font-size: 0.82rem;
}
.drawer-dl dd {
  margin: 0;
  color: var(--admin-text);
  font-size: 0.85rem;
  font-weight: 500;
}
.method-tag {
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: var(--admin-surface-muted);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.78rem;
}
.key-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.65rem;
  border-radius: 6px;
  background: var(--admin-surface-muted);
}
.key-label {
  font-size: 0.78rem;
  color: var(--admin-muted);
}
.key-val {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.key-val code {
  font-size: 0.76rem;
  color: var(--admin-text);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
.form-row {
  display: flex;
  gap: 0.5rem;
}
.danger-zone {
  border-radius: 8px;
  padding: 1rem;
  background: color-mix(in srgb, var(--admin-danger) 4%, transparent);
  border: 1px dashed color-mix(in srgb, var(--admin-danger) 30%, var(--admin-border));
}
.text-danger {
  color: var(--admin-danger) !important;
}
.danger-desc {
  margin: 0;
  font-size: 0.75rem;
  color: var(--admin-muted);
}
.danger-actions {
  display: flex;
  gap: 0.5rem;
}
</style>
