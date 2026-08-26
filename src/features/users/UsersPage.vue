<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NButton, NDrawer, NDrawerContent, NInput, NModal, NSelect, NSpin, useMessage, useNotification } from 'naive-ui'
import type { User } from '@/domain/user'
import { useNodesQuery, useUsersQuery } from '@/query/use-headscale-queries'
import { useCreateUserMutation, useDeleteUserMutation, useRenameUserMutation } from '@/query/use-headscale-mutations'

const { t } = useI18n()
const message = useMessage()
const notification = useNotification()
const query = useUsersQuery()
const nodes = useNodesQuery()
const createUser = useCreateUserMutation()
const renameUser = useRenameUserMutation()
const deleteUser = useDeleteUserMutation()
const search = ref('')
const provider = ref<string | null>(null)
const selected = ref<User | null>(null)
const creating = ref(false)
const newName = ref('')
const renameValue = ref('')
const deleteName = ref('')

const providers = computed(() => {
  const values = new Set((query.data.value ?? []).map((user) => user.provider).filter(Boolean))
  return [{ label: t('users.allProviders'), value: '' }, ...[...values].map((value) => ({ label: value, value }))]
})
const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (query.data.value ?? []).filter((user) => {
    const matchesProvider = !provider.value || user.provider === provider.value
    const haystack = `${user.name} ${user.displayName} ${user.email}`.toLowerCase()
    return matchesProvider && (!term || haystack.includes(term))
  })
})
const relatedNodeCount = computed(
  () => nodes.data.value?.filter((node) => node.user.id === selected.value?.id).length ?? 0,
)

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
  if (!selected.value || deleteName.value !== selected.value.name) return
  try {
    await deleteUser.mutateAsync(selected.value.id)
    message.success(t('common.success'))
    selected.value = null
    deleteName.value = ''
  } catch {
    notification.error({ title: t('common.failed') })
  }
}
</script>

<template>
  <section>
    <h1>{{ t('users.title') }}</h1>
    <div class="toolbar">
      <NInput v-model:value="search" :placeholder="t('common.search')" :aria-label="t('common.search')" />
      <NSelect :value="provider ?? ''" :options="providers" :aria-label="t('users.provider')" @update:value="provider = $event || null" />
      <NButton type="primary" @click="creating = true">{{ t('common.create') }}</NButton>
    </div>
    <NAlert v-if="query.isError.value" type="error">{{ t('common.error') }}</NAlert>
    <NSpin :show="query.isLoading.value">
      <p v-if="!query.isLoading.value && filtered.length === 0">{{ t('common.empty') }}</p>
      <table v-else>
        <thead>
          <tr>
            <th>{{ t('users.name') }}</th>
            <th>{{ t('users.email') }}</th>
            <th>{{ t('users.provider') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filtered" :key="user.id">
            <td><button type="button" @click="selected = user; renameValue = user.name; deleteName = ''">{{ user.name }}</button></td>
            <td>{{ user.email }}</td>
            <td>{{ user.provider }}</td>
          </tr>
        </tbody>
      </table>
    </NSpin>
    <NModal v-model:show="creating" :title="t('common.create')">
      <div class="dialog">
        <NInput v-model:value="newName" :aria-label="t('users.name')" :placeholder="t('users.name')" />
        <NButton type="primary" :disabled="!newName.trim() || createUser.isPending.value" :loading="createUser.isPending.value" @click="onCreate">{{ t('common.save') }}</NButton>
      </div>
    </NModal>
    <NDrawer :show="Boolean(selected)" @update:show="(value: boolean) => !value && (selected = null)">
      <NDrawerContent :title="t('common.details')">
        <template v-if="selected">
          <NInput v-model:value="renameValue" :aria-label="t('common.rename')" />
          <NButton :disabled="renameUser.isPending.value" @click="onRename">{{ t('common.rename') }}</NButton>
          <p>{{ t('users.relatedNodes') }}: {{ relatedNodeCount }}</p>
          <NInput v-model:value="deleteName" :aria-label="t('users.confirmName')" :placeholder="t('users.confirmName')" />
          <NButton type="error" :disabled="deleteName !== selected.name || deleteUser.isPending.value" @click="onDelete">{{ t('common.delete') }}</NButton>
        </template>
      </NDrawerContent>
    </NDrawer>
  </section>
</template>

<style scoped>
.toolbar, .dialog { display: flex; gap: 0.75rem; margin-bottom: 1rem; max-width: 48rem; flex-wrap: wrap; }
</style>
