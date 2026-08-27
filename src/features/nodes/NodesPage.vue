<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
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
import { Clock, KeyRound, Search, Server, Tags } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import PageToolbar from '@/components/ui/PageToolbar.vue'
import AppDataTable from '@/components/ui/AppDataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useMaskedKey } from '@/composables/use-masked-key'
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
const route = useRoute()
const router = useRouter()
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
const search = ref('')
const status = ref<'all' | 'online' | 'offline'>('all')
const ownerId = ref(typeof route.query.userId === 'string' ? route.query.userId : '')
const selected = ref<Node | null>(null)
const renameValue = ref('')
const tagsValue = ref('')
const confirmExpire = ref(false)
const confirmDelete = ref(false)

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

watch(
  () => route.query.userId,
  (value) => {
    ownerId.value = typeof value === 'string' ? value : ''
  },
)

watch(ownerId, (value) => {
  const current = typeof route.query.userId === 'string' ? route.query.userId : ''
  if (value === current) return
  const nextQuery = { ...route.query }
  if (value) nextQuery.userId = value
  else delete nextQuery.userId
  void router.replace({ query: nextQuery })
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
    render: (node) => h('strong', { class: 'node-name' }, node.givenName || node.name),
  },
  { title: t('nodes.user'), key: 'user', width: 130, render: (node) => node.user.name },
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
    width: 110,
    fixed: 'right',
    render: (node) =>
      h(
        NButton,
        { size: 'small', secondary: true, onClick: () => open(node) },
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
    <PageHeader :title="t('nodes.title')" :description="t('nodes.description')" />

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
            <h2><Server :size="17" aria-hidden="true" />{{ t('nodes.overview') }}</h2>
            <dl>
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
                <dd>{{ selected.registerMethod }}</dd>
              </div>
              <div>
                <dt>{{ t('nodes.createdAt') }}</dt>
                <dd>{{ formatDate(selected.createdAt) }}</dd>
              </div>
            </dl>
          </section>

          <section class="drawer-section">
            <h2><KeyRound :size="17" aria-hidden="true" />{{ t('nodes.keys') }}</h2>
            <code>{{ t('nodes.machineKey') }}: {{ mask(selected.machineKey) }}</code>
            <code>{{ t('nodes.nodeKey') }}: {{ mask(selected.nodeKey) }}</code>
            <code>{{ t('nodes.discoKey') }}: {{ mask(selected.discoKey) }}</code>
          </section>

          <section class="drawer-section">
            <h2>{{ t('common.rename') }}</h2>
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
          </section>

          <section class="drawer-section">
            <h2><Tags :size="17" aria-hidden="true" />{{ t('nodes.setTags') }}</h2>
            <NInput
              v-model:value="tagsValue"
              :input-props="{ 'aria-label': t('nodes.setTags') }"
              :placeholder="t('nodes.tagsPlaceholder')"
            />
            <NButton :loading="setTags.isPending.value" @click="onSetTags">{{
              t('nodes.setTags')
            }}</NButton>
          </section>

          <section class="drawer-section danger-zone">
            <h2><Clock :size="17" aria-hidden="true" />{{ t('nodes.dangerZone') }}</h2>
            <NSpace vertical>
              <NButton type="warning" secondary @click="confirmExpire = true">{{
                t('nodes.expireNow')
              }}</NButton>
              <NButton type="error" secondary @click="confirmDelete = true">{{
                t('common.delete')
              }}</NButton>
            </NSpace>
          </section>
        </div>
      </NDrawerContent>
    </NDrawer>

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
      :confirm-text="t('nodes.confirmName')"
      :expected-text="selected.givenName || selected.name"
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
}
:deep(.ip-chip) {
  color: var(--admin-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.drawer-stack {
  display: grid;
  gap: 1rem;
}
.drawer-section {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
  background: var(--admin-surface-muted);
}
.drawer-section h2 {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin: 0;
  color: var(--admin-text);
  font-size: 0.92rem;
}
.drawer-section code {
  overflow-wrap: anywhere;
  color: var(--admin-muted);
  font-size: 0.75rem;
}
dl {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}
dl div {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}
dt {
  color: var(--admin-muted);
}
dd {
  margin: 0;
  color: var(--admin-text);
  font-weight: 600;
  text-align: right;
}
.danger-zone {
  border-color: color-mix(in srgb, var(--admin-danger) 35%, var(--admin-border));
}
</style>
