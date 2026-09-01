<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NInput,
  NModal,
  NSelect,
  NSpace,
  useMessage,
  useNotification,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { Plus, Search, UserRound } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import PageToolbar from '@/components/ui/PageToolbar.vue'
import AppDataTable from '@/components/ui/AppDataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useListViewState } from '@/composables/use-list-view-state'
import { formatDateTime } from '@/domain/datetime'
import type { User } from '@/domain/user'
import { useNodesQuery, useUsersQuery } from '@/query/use-headscale-queries'
import { useSettingsStore } from '@/stores/settings'
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useRenameUserMutation,
} from '@/query/use-headscale-mutations'

const { t } = useI18n()
const router = useRouter()
const message = useMessage()
const notification = useNotification()
const settings = useSettingsStore()
const query = useUsersQuery()
const nodes = useNodesQuery()
const createUser = useCreateUserMutation()
const renameUser = useRenameUserMutation()
const deleteUser = useDeleteUserMutation()
const listView = useListViewState({
  filters: {
    q: { queryKey: 'q', defaultValue: '' },
    provider: { queryKey: 'provider', defaultValue: '' },
  },
  sortKeys: ['name', 'email', 'provider', 'nodeCount', 'createdAt'] as const,
})
const search = listView.filters.q
const provider = listView.filters.provider
const selected = ref<User | null>(null)
const creating = ref(false)
const confirmDelete = ref(false)
const newName = ref('')
const renameValue = ref('')

const providers = computed(() => {
  const values = new Set((query.data.value ?? []).map((user) => user.provider).filter(Boolean))
  return [
    { label: t('users.allProviders'), value: '' },
    ...[...values].map((value) => ({ label: value, value })),
  ]
})
const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (query.data.value ?? []).filter((user) => {
    const matchesProvider = !provider.value || user.provider === provider.value
    const haystack = `${user.name} ${user.displayName} ${user.email}`.toLowerCase()
    return matchesProvider && (!term || haystack.includes(term))
  })
})
const pagination = listView.pagination(computed(() => filtered.value.length))
listView.syncFocusPage(filtered)
const nodeCounts = computed(() => {
  if (!nodes.data.value) return null
  const counts = new Map<string, number>()
  for (const node of nodes.data.value) {
    counts.set(node.user.id, (counts.get(node.user.id) ?? 0) + 1)
  }
  return counts
})

function nodeCount(userId: string) {
  return nodeCounts.value?.get(userId) ?? (nodeCounts.value ? 0 : null)
}

function openUserNodes(user: User) {
  void router.push({ path: '/nodes', query: { userId: user.id } })
}

const relatedNodeCount = computed(() =>
  nodes.isSuccess.value && !nodes.isFetching.value
    ? (nodes.data.value?.filter((node) => node.user.id === selected.value?.id).length ?? 0)
    : null,
)
const relatedNodeCountLabel = computed(() => relatedNodeCount.value ?? t('common.unavailable'))

watch(relatedNodeCount, (count) => {
  if (count === null) confirmDelete.value = false
})

function retryRequiredQueries() {
  void Promise.all([query.refetch(), nodes.refetch()])
}

function formatDate(date: Date) {
  return formatDateTime(date, { locale: settings.locale, style: settings.dateTimeStyle })
}

function openDetails(user: User) {
  selected.value = user
  renameValue.value = user.name
}

const columns = computed<DataTableColumns<User>>(() => [
  {
    title: t('users.name'),
    key: 'name',
    minWidth: 190,
    sorter: (left, right) =>
      (left.displayName || left.name).localeCompare(right.displayName || right.name),
    sortOrder: listView.sortOrderFor('name'),
    render: (user) =>
      h('div', { class: 'user-cell' }, [
        h('strong', user.displayName || user.name),
        user.displayName ? h('span', user.name) : null,
      ]),
  },
  {
    title: t('users.email'),
    key: 'email',
    minWidth: 210,
    sorter: (left, right) => left.email.localeCompare(right.email),
    sortOrder: listView.sortOrderFor('email'),
    render: (user) => user.email || '—',
  },
  {
    title: t('users.provider'),
    key: 'provider',
    width: 140,
    sorter: (left, right) => left.provider.localeCompare(right.provider),
    sortOrder: listView.sortOrderFor('provider'),
    render: (user) =>
      h(StatusBadge, { label: user.provider || '—', tone: user.provider ? 'info' : 'neutral' }),
  },
  {
    title: t('users.nodeCount'),
    key: 'nodeCount',
    width: 130,
    sorter: (left, right) => (nodeCount(left.id) ?? 0) - (nodeCount(right.id) ?? 0),
    sortOrder: listView.sortOrderFor('nodeCount'),
    render: (user) => {
      const count = nodeCount(user.id)
      return count === null
        ? t('common.unavailable')
        : h(
            NButton,
            {
              text: true,
              type: 'primary',
              'aria-label': t('users.viewNodes', { count, name: user.name }),
              onClick: () => openUserNodes(user),
            },
            { default: () => String(count) },
          )
    },
  },
  {
    title: t('users.createdAt'),
    key: 'createdAt',
    width: 150,
    sorter: (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    sortOrder: listView.sortOrderFor('createdAt'),
    render: (user) => formatDate(user.createdAt),
  },
  {
    title: t('common.details'),
    key: 'actions',
    width: 120,
    render: (user) =>
      h(
        NButton,
        { size: 'small', secondary: true, onClick: () => openDetails(user) },
        { default: () => t('common.details') },
      ),
  },
])

async function onCreate() {
  try {
    await createUser.mutateAsync({ name: newName.value.trim() })
    message.success(t('common.success'))
    creating.value = false
    newName.value = ''
  } catch {
    notification.error({ title: t('common.failed') })
  }
}

async function onRename() {
  if (!selected.value) return
  try {
    await renameUser.mutateAsync({ userId: selected.value.id, newName: renameValue.value.trim() })
    message.success(t('common.success'))
    selected.value = null
  } catch {
    notification.error({ title: t('common.failed') })
  }
}

async function onDelete() {
  if (!selected.value || relatedNodeCount.value === null) return
  try {
    await deleteUser.mutateAsync(selected.value.id)
    message.success(t('common.success'))
    confirmDelete.value = false
    selected.value = null
  } catch {
    notification.error({ title: t('common.failed') })
  }
}
</script>

<template>
  <section class="admin-page users-page">
    <PageHeader :title="t('users.title')" :description="t('users.description')">
      <template #actions>
        <NButton type="primary" @click="creating = true">
          <template #icon><Plus :size="17" aria-hidden="true" /></template>
          {{ t('common.create') }}
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
        :value="provider"
        :options="providers"
        :aria-label="t('users.provider')"
        class="provider-select"
        @update:value="provider = $event || ''"
      />
    </PageToolbar>

    <EmptyState
      v-if="(query.isError.value && filtered.length > 0) || nodes.isError.value"
      :title="t('common.error')"
    >
      <template #action>
        <NButton secondary @click="retryRequiredQueries">{{ t('common.retry') }}</NButton>
      </template>
    </EmptyState>

    <AppDataTable
      :columns="columns"
      :data="filtered"
      :loading="query.isLoading.value"
      :row-key="(user) => user.id"
      :aria-label="t('users.title')"
      :scroll-x="950"
      :pagination="pagination"
      :row-class-name="(user: User) => (user.id === listView.focusId.value ? 'is-focused' : '')"
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

    <NModal
      v-model:show="creating"
      preset="card"
      :title="t('users.createTitle')"
      style="width: min(28rem, calc(100vw - 2rem))"
    >
      <div class="form-stack">
        <label>
          <span>{{ t('users.name') }}</span>
          <NInput v-model:value="newName" :input-props="{ 'aria-label': t('users.name') }" />
        </label>
        <NSpace justify="end">
          <NButton @click="creating = false">{{ t('common.cancel') }}</NButton>
          <NButton
            type="primary"
            :disabled="!newName.trim() || createUser.isPending.value"
            :loading="createUser.isPending.value"
            @click="onCreate"
          >
            {{ t('common.save') }}
          </NButton>
        </NSpace>
      </div>
    </NModal>

    <NDrawer
      :show="Boolean(selected)"
      width="min(420px, calc(100vw - 16px))"
      @update:show="(value: boolean) => !value && (selected = null)"
    >
      <NDrawerContent v-if="selected" :title="selected.displayName || selected.name" closable>
        <div class="drawer-stack">
          <section class="drawer-section">
            <h2><UserRound :size="17" aria-hidden="true" />{{ t('common.details') }}</h2>
            <dl>
              <div>
                <dt>{{ t('users.email') }}</dt>
                <dd>{{ selected.email || '—' }}</dd>
              </div>
              <div>
                <dt>{{ t('users.provider') }}</dt>
                <dd>{{ selected.provider || '—' }}</dd>
              </div>
              <div>
                <dt>{{ t('users.relatedNodes') }}</dt>
                <dd>{{ relatedNodeCountLabel }}</dd>
              </div>
            </dl>
          </section>
          <section class="drawer-section">
            <h2>{{ t('common.rename') }}</h2>
            <NInput
              v-model:value="renameValue"
              :input-props="{ 'aria-label': t('common.rename') }"
            />
            <NButton
              :disabled="!renameValue.trim() || renameUser.isPending.value"
              :loading="renameUser.isPending.value"
              @click="onRename"
              >{{ t('common.rename') }}</NButton
            >
          </section>
          <section class="drawer-section danger-zone">
            <h2>{{ t('users.dangerZone') }}</h2>
            <p>{{ t('users.deleteHint', { count: relatedNodeCountLabel }) }}</p>
            <NButton
              type="error"
              secondary
              :disabled="relatedNodeCount === null"
              @click="confirmDelete = true"
              >{{ t('common.delete') }}</NButton
            >
          </section>
        </div>
      </NDrawerContent>
    </NDrawer>

    <ConfirmDialog
      v-if="selected && relatedNodeCount !== null"
      v-model:show="confirmDelete"
      :title="t('users.deleteTitle')"
      :message="t('users.deleteMessage', { name: selected.name, count: relatedNodeCountLabel })"
      :confirm-label="t('users.confirmDelete')"
      danger
      :pending="deleteUser.isPending.value"
      @confirm="onDelete"
    />
  </section>
</template>

<style scoped>
.search-input {
  width: min(24rem, 100%);
}
.provider-select {
  width: min(13rem, 100%);
}
.form-stack,
.drawer-stack {
  display: grid;
  gap: 1rem;
}
.form-stack label {
  display: grid;
  gap: 0.45rem;
  color: var(--admin-text);
  font-size: 0.82rem;
  font-weight: 600;
}
.user-cell {
  display: grid;
  gap: 0.15rem;
}
.user-cell strong {
  color: var(--admin-text);
}
.user-cell span {
  color: var(--admin-muted);
  font-size: 0.75rem;
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
.drawer-section p {
  margin: 0;
  color: var(--admin-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}
dl {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}
dl div {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}
dt {
  color: var(--admin-muted);
}
dd {
  margin: 0;
  color: var(--admin-text);
  font-weight: 600;
}
.danger-zone {
  border-color: color-mix(in srgb, var(--admin-danger) 35%, var(--admin-border));
}
</style>
