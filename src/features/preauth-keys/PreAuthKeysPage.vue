<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NCheckbox,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NTag,
  useMessage,
  useNotification,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { KeyRound, Plus } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import PageToolbar from '@/components/ui/PageToolbar.vue'
import AppDataTable from '@/components/ui/AppDataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { formatDateTime } from '@/domain/datetime'
import { normalizeTags } from '@/domain/tags'
import type { PreAuthKey, PreAuthKeyState } from '@/domain/preauth-key'
import { usePreAuthKeysQuery, useUsersQuery } from '@/query/use-headscale-queries'
import { useSettingsStore } from '@/stores/settings'
import {
  useCreatePreAuthKeyMutation,
  useDeletePreAuthKeyMutation,
  useExpirePreAuthKeyMutation,
} from '@/query/use-headscale-mutations'

const { t } = useI18n()
const message = useMessage()
const notification = useNotification()
const settings = useSettingsStore()
const query = usePreAuthKeysQuery()
const users = useUsersQuery()
const createKey = useCreatePreAuthKeyMutation()
const expireKey = useExpirePreAuthKeyMutation()
const deleteKey = useDeletePreAuthKeyMutation()
const state = ref<PreAuthKeyState | 'all'>('all')
const creating = ref(false)
const userId = ref('')
const reusable = ref(false)
const ephemeral = ref(false)
const tags = ref('')
const plaintext = ref<string | null>(null)
const saved = ref(false)
const pendingAction = ref<{ kind: 'expire' | 'delete'; key: PreAuthKey } | null>(null)
type BulkDeleteState = Extract<PreAuthKeyState, 'expired' | 'used'>
const bulkDeleteState = ref<BulkDeleteState | null>(null)
const pendingBulkDeleteIds = ref<string[]>([])
const deletingBulk = ref(false)

const filtered = computed(() =>
  (query.data.value ?? []).filter((key) => state.value === 'all' || key.state === state.value),
)
const expiredKeys = computed(() =>
  (query.data.value ?? []).filter((key) => key.state === 'expired'),
)
const usedKeys = computed(() => (query.data.value ?? []).filter((key) => key.state === 'used'))
const userOptions = computed(() =>
  (users.data.value ?? []).map((user) => ({ label: user.name, value: user.id })),
)
const options = computed(() => [
  { label: t('routes.filterAll'), value: 'all' },
  { label: t('preAuthKeys.active'), value: 'active' },
  { label: t('preAuthKeys.used'), value: 'used' },
  { label: t('preAuthKeys.expired'), value: 'expired' },
])

function formatDate(date: Date | null) {
  return formatDateTime(date, { locale: settings.locale, style: settings.dateTimeStyle })
}

function stateBadge(key: PreAuthKey) {
  const tone = key.state === 'active' ? 'success' : key.state === 'used' ? 'info' : 'neutral'
  return h(StatusBadge, { label: t(`preAuthKeys.${key.state}`), tone })
}

const columns = computed<DataTableColumns<PreAuthKey>>(() => [
  {
    title: t('preAuthKeys.key'),
    key: 'key',
    minWidth: 170,
    render: (key) => h('code', key.keyPreview ?? '—'),
  },
  { title: t('preAuthKeys.user'), key: 'user', width: 150, render: (key) => key.user?.name ?? '—' },
  { title: t('preAuthKeys.state'), key: 'state', width: 120, render: stateBadge },
  {
    title: t('preAuthKeys.expiration'),
    key: 'expiration',
    width: 160,
    render: (key) => formatDate(key.expiration),
  },
  {
    title: t('preAuthKeys.properties'),
    key: 'properties',
    minWidth: 190,
    render: (key) =>
      h(
        NSpace,
        { size: 4, wrap: true },
        {
          default: () =>
            [
              key.reusable
                ? h(
                    NTag,
                    { size: 'small', bordered: false },
                    { default: () => t('preAuthKeys.reusable') },
                  )
                : null,
              key.ephemeral
                ? h(
                    NTag,
                    { size: 'small', bordered: false },
                    { default: () => t('preAuthKeys.ephemeral') },
                  )
                : null,
              ...key.aclTags.map((tag) =>
                h(NTag, { key: tag, size: 'small', bordered: false }, { default: () => tag }),
              ),
            ].filter(Boolean),
        },
      ),
  },
  {
    title: t('common.details'),
    key: 'actions',
    width: 180,
    render: (key) =>
      h(
        NSpace,
        { size: 6 },
        {
          default: () => [
            h(
              NButton,
              {
                size: 'small',
                secondary: true,
                disabled: key.state !== 'active' || expireKey.isPending.value,
                onClick: () => {
                  pendingAction.value = { kind: 'expire', key }
                },
              },
              { default: () => t('common.expire') },
            ),
            h(
              NButton,
              {
                size: 'small',
                type: 'error',
                secondary: true,
                disabled: deleteKey.isPending.value,
                onClick: () => {
                  pendingAction.value = { kind: 'delete', key }
                },
              },
              { default: () => t('common.delete') },
            ),
          ],
        },
      ),
  },
])

function retryRequiredQueries() {
  void Promise.all([query.refetch(), users.refetch()])
}

async function onCreate() {
  try {
    const created = await createKey.mutateAsync({
      userId: userId.value,
      reusable: reusable.value,
      ephemeral: ephemeral.value,
      expiration: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      aclTags: tags.value ? normalizeTags(tags.value.split(',')) : [],
    })
    plaintext.value = created.plaintext
    saved.value = false
    creating.value = false
    userId.value = ''
    tags.value = ''
    message.success(t('common.success'))
  } catch {
    notification.error({ title: t('common.failed') })
  }
}

async function copyPlaintext() {
  if (plaintext.value) await navigator.clipboard.writeText(plaintext.value)
}

function closePlaintext(force = false) {
  if (!force && !saved.value) return
  plaintext.value = null
  saved.value = false
}

async function confirmAction() {
  if (!pendingAction.value) return
  const action = pendingAction.value
  try {
    if (action.kind === 'expire') await expireKey.mutateAsync(action.key.id)
    else await deleteKey.mutateAsync(action.key.id)
    message.success(t('common.success'))
    pendingAction.value = null
  } catch {
    notification.error({ title: t('common.failed') })
  }
}

function openBulkDelete(kind: BulkDeleteState, keys: PreAuthKey[]) {
  pendingBulkDeleteIds.value = keys.map((key) => key.id)
  bulkDeleteState.value = pendingBulkDeleteIds.value.length > 0 ? kind : null
}

function updateBulkDeleteDialog(show: boolean) {
  if (show) return
  if (!deletingBulk.value) {
    pendingBulkDeleteIds.value = []
    bulkDeleteState.value = null
  }
}

async function deleteBulkKeys() {
  const kind = bulkDeleteState.value
  const ids = [...pendingBulkDeleteIds.value]
  if (!kind || !ids.length) return
  deletingBulk.value = true
  const failedIds: string[] = []
  let deletedCount = 0
  for (const id of ids) {
    try {
      await deleteKey.mutateAsync(id)
      deletedCount += 1
    } catch {
      failedIds.push(id)
    }
  }
  await query.refetch()
  deletingBulk.value = false
  if (!failedIds.length) {
    pendingBulkDeleteIds.value = []
    bulkDeleteState.value = null
    message.success(t('common.success'))
    return
  }
  pendingBulkDeleteIds.value = failedIds
  notification.error({
    title: t('common.failed'),
    content: t(
      kind === 'expired'
        ? 'preAuthKeys.deleteExpiredPartial'
        : 'preAuthKeys.deleteUsedPartial',
      { deleted: deletedCount, failed: failedIds.length },
    ),
  })
}
</script>

<template>
  <section class="admin-page keys-page">
    <PageHeader :title="t('preAuthKeys.title')" :description="t('preAuthKeys.description')">
      <template #actions>
        <NSpace>
          <NButton
            type="error"
            secondary
            :disabled="!expiredKeys.length || query.isError.value || deletingBulk"
            :loading="deletingBulk && bulkDeleteState === 'expired'"
            @click="openBulkDelete('expired', expiredKeys)"
          >
            {{ t('preAuthKeys.deleteExpired', { count: expiredKeys.length }) }}
          </NButton>
          <NButton
            type="error"
            secondary
            :disabled="!usedKeys.length || query.isError.value || deletingBulk"
            :loading="deletingBulk && bulkDeleteState === 'used'"
            @click="openBulkDelete('used', usedKeys)"
          >
            {{ t('preAuthKeys.deleteUsed', { count: usedKeys.length }) }}
          </NButton>
          <NButton type="primary" :disabled="users.isError.value" @click="creating = true">
            <template #icon><Plus :size="17" aria-hidden="true" /></template>
            {{ t('common.create') }}
          </NButton>
        </NSpace>
      </template>
    </PageHeader>
    <PageToolbar>
      <NSelect
        v-model:value="state"
        :options="options"
        :aria-label="t('common.filter')"
        class="filter-select"
      />
    </PageToolbar>
    <EmptyState
      v-if="(query.isError.value && filtered.length > 0) || users.isError.value"
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
      :row-key="(key) => key.id"
      :aria-label="t('preAuthKeys.title')"
      :scroll-x="980"
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
      :title="t('preAuthKeys.createTitle')"
      style="width: min(32rem, calc(100vw - 2rem))"
    >
      <div class="form-stack">
        <label
          ><span>{{ t('preAuthKeys.user') }}</span
          ><NSelect
            v-model:value="userId"
            :options="userOptions"
            :aria-label="t('preAuthKeys.user')"
        /></label>
        <div class="checks">
          <NCheckbox v-model:checked="reusable">{{ t('preAuthKeys.reusable') }}</NCheckbox
          ><NCheckbox v-model:checked="ephemeral">{{ t('preAuthKeys.ephemeral') }}</NCheckbox>
        </div>
        <label
          ><span>{{ t('nodes.tags') }}</span
          ><NInput
            v-model:value="tags"
            :input-props="{ 'aria-label': t('nodes.tags') }"
            :placeholder="t('nodes.tagsPlaceholder')"
        /></label>
        <p class="hint">{{ t('preAuthKeys.defaultExpiration') }}</p>
        <NSpace justify="end"
          ><NButton @click="creating = false">{{ t('common.cancel') }}</NButton
          ><NButton
            type="primary"
            :disabled="!userId"
            :loading="createKey.isPending.value"
            @click="onCreate"
            >{{ t('common.save') }}</NButton
          ></NSpace
        >
      </div>
    </NModal>

    <NModal
      :show="Boolean(plaintext)"
      :mask-closable="false"
      :closable="false"
      preset="card"
      :title="t('preAuthKeys.createdTitle')"
      style="width: min(34rem, calc(100vw - 2rem))"
    >
      <div v-if="plaintext" class="plaintext-card">
        <div class="key-icon"><KeyRound :size="24" aria-hidden="true" /></div>
        <p>{{ t('preAuthKeys.plaintextWarning') }}</p>
        <code>{{ plaintext }}</code>
        <NButton @click="copyPlaintext">{{ t('common.copy') }}</NButton>
        <NCheckbox v-model:checked="saved">{{ t('preAuthKeys.savedConfirm') }}</NCheckbox>
        <NSpace justify="end"
          ><NButton @click="closePlaintext(true)">{{ t('preAuthKeys.forceClose') }}</NButton
          ><NButton type="primary" :disabled="!saved" @click="closePlaintext()">{{
            t('common.close')
          }}</NButton></NSpace
        >
      </div>
    </NModal>

    <ConfirmDialog
      :show="Boolean(bulkDeleteState)"
      :title="
        bulkDeleteState === 'used'
          ? t('preAuthKeys.deleteUsedTitle')
          : t('preAuthKeys.deleteExpiredTitle')
      "
      :message="
        bulkDeleteState === 'used'
          ? t('preAuthKeys.deleteUsedMessage', { count: pendingBulkDeleteIds.length })
          : t('preAuthKeys.deleteExpiredMessage', { count: pendingBulkDeleteIds.length })
      "
      :confirm-label="
        bulkDeleteState === 'used'
          ? t('preAuthKeys.deleteUsedAction')
          : t('preAuthKeys.deleteExpiredAction')
      "
      danger
      :pending="deletingBulk"
      @update:show="updateBulkDeleteDialog"
      @confirm="deleteBulkKeys"
    />

    <ConfirmDialog
      :show="Boolean(pendingAction)"
      :title="
        pendingAction?.kind === 'expire'
          ? t('preAuthKeys.expireTitle')
          : t('preAuthKeys.deleteTitle')
      "
      :message="
        pendingAction?.kind === 'expire'
          ? t('preAuthKeys.expireMessage', { id: pendingAction?.key.id ?? '' })
          : t('preAuthKeys.deleteMessage', {
              id: pendingAction?.key.id ?? '',
              user: pendingAction?.key.user?.name ?? '—',
            })
      "
      :confirm-label="pendingAction?.kind === 'expire' ? t('common.expire') : t('common.delete')"
      danger
      :pending="expireKey.isPending.value || deleteKey.isPending.value"
      @update:show="!$event && (pendingAction = null)"
      @confirm="confirmAction"
    />
  </section>
</template>

<style scoped>
.filter-select {
  width: min(16rem, 100%);
}
.form-stack,
.plaintext-card {
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
.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.hint,
.plaintext-card p {
  margin: 0;
  color: var(--admin-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}
.plaintext-card > code {
  overflow-wrap: anywhere;
  padding: 0.85rem;
  border: 1px solid var(--admin-border);
  border-radius: 0.7rem;
  color: var(--admin-text);
  background: var(--admin-surface-muted);
}
.key-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border-radius: 0.85rem;
  color: var(--admin-primary);
  background: var(--admin-primary-soft);
}
:deep(.n-data-table code) {
  color: var(--admin-text);
}
</style>
