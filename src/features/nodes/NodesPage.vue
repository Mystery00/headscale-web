<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NButton, NDrawer, NDrawerContent, NInput, NSpin, useMessage, useNotification } from 'naive-ui'
import { useMaskedKey } from '@/composables/use-masked-key'
import { normalizeTags } from '@/domain/tags'
import type { Node } from '@/domain/node'
import { useNodesQuery } from '@/query/use-headscale-queries'
import { useDeleteNodeMutation, useExpireNodeNowMutation, useRenameNodeMutation, useSetNodeTagsMutation } from '@/query/use-headscale-mutations'

const { t } = useI18n()
const { mask } = useMaskedKey()
const message = useMessage()
const notification = useNotification()
const query = useNodesQuery()
const renameNode = useRenameNodeMutation()
const setTags = useSetNodeTagsMutation()
const expireNow = useExpireNodeNowMutation()
const deleteNode = useDeleteNodeMutation()
const search = ref('')
const selected = ref<Node | null>(null)
const renameValue = ref('')
const tagsValue = ref('')
const deleteName = ref('')

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (query.data.value ?? []).filter((node) => {
    const haystack = `${node.givenName} ${node.name} ${node.user.name} ${node.ipAddresses.join(' ')}`.toLowerCase()
    return !term || haystack.includes(term)
  })
})

function open(node: Node) {
  selected.value = node
  renameValue.value = node.givenName || node.name
  tagsValue.value = node.tags.join(', ')
  deleteName.value = ''
}

async function run(action: () => Promise<unknown>) {
  try {
    await action()
    message.success(t('common.success'))
  } catch {
    notification.error({ title: t('common.failed') })
  }
}
</script>

<template>
  <section>
    <h1>{{ t('nodes.title') }}</h1>
    <NInput v-model:value="search" :placeholder="t('common.search')" :aria-label="t('common.search')" />
    <NAlert v-if="query.isError.value" type="error">{{ t('common.error') }}</NAlert>
    <NSpin :show="query.isLoading.value">
      <p v-if="!query.isLoading.value && filtered.length === 0">{{ t('common.empty') }}</p>
      <table v-else>
        <thead>
          <tr>
            <th>{{ t('nodes.status') }}</th>
            <th>{{ t('nodes.name') }}</th>
            <th>{{ t('nodes.user') }}</th>
            <th>{{ t('nodes.ip') }}</th>
            <th>{{ t('nodes.tags') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="node in filtered" :key="node.id">
            <td>{{ node.online ? t('common.online') : t('common.offline') }}</td>
            <td><button type="button" @click="open(node)">{{ node.givenName || node.name }}</button></td>
            <td>{{ node.user.name }}</td>
            <td>{{ node.ipAddresses.join(', ') }}</td>
            <td>{{ node.tags.join(', ') }}</td>
          </tr>
        </tbody>
      </table>
    </NSpin>
    <NDrawer :show="Boolean(selected)" @update:show="(value: boolean) => !value && (selected = null)">
      <NDrawerContent :title="t('common.details')">
        <template v-if="selected">
          <p>{{ t('nodes.machineKey') }}: {{ mask(selected.machineKey) }}</p>
          <NInput v-model:value="renameValue" :aria-label="t('common.rename')" />
          <NButton :disabled="renameNode.isPending.value" @click="run(() => renameNode.mutateAsync({ nodeId: selected!.id, newName: renameValue }))">{{ t('common.rename') }}</NButton>
          <NInput v-model:value="tagsValue" :aria-label="t('nodes.setTags')" />
          <NButton :disabled="setTags.isPending.value" @click="run(() => setTags.mutateAsync({ nodeId: selected!.id, tags: normalizeTags(tagsValue.split(',')) }))">{{ t('nodes.setTags') }}</NButton>
          <NButton type="warning" :disabled="expireNow.isPending.value" @click="run(() => expireNow.mutateAsync(selected!.id))">{{ t('nodes.expireNow') }}</NButton>
          <NInput v-model:value="deleteName" :aria-label="t('nodes.confirmName')" :placeholder="t('nodes.confirmName')" />
          <NButton type="error" :disabled="deleteName !== (selected.givenName || selected.name) || deleteNode.isPending.value" @click="run(() => deleteNode.mutateAsync(selected!.id))">{{ t('common.delete') }}</NButton>
        </template>
      </NDrawerContent>
    </NDrawer>
  </section>
</template>
