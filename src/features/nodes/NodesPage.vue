<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NDrawer, NDrawerContent, NInput, NSpin } from 'naive-ui'
import { useMaskedKey } from '@/composables/use-masked-key'
import type { Node } from '@/domain/node'
import { useNodesQuery } from '@/query/use-headscale-queries'

const { t } = useI18n()
const { mask } = useMaskedKey()
const query = useNodesQuery()
const search = ref('')
const selected = ref<Node | null>(null)

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (query.data.value ?? []).filter((node) => {
    const haystack =
      `${node.givenName} ${node.name} ${node.user.name} ${node.ipAddresses.join(' ')}`.toLowerCase()
    return !term || haystack.includes(term)
  })
})
</script>

<template>
  <section>
    <h1>{{ t('nodes.title') }}</h1>
    <NInput
      v-model:value="search"
      :placeholder="t('common.search')"
      :aria-label="t('common.search')"
    />
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
            <td>
              <button type="button" @click="selected = node">
                {{ node.givenName || node.name }}
              </button>
            </td>
            <td>{{ node.user.name }}</td>
            <td>{{ node.ipAddresses.join(', ') }}</td>
            <td>{{ node.tags.join(', ') }}</td>
          </tr>
        </tbody>
      </table>
    </NSpin>
    <NDrawer
      :show="Boolean(selected)"
      @update:show="(value: boolean) => !value && (selected = null)"
    >
      <NDrawerContent :title="t('common.details')">
        <template v-if="selected">
          <p>{{ t('nodes.machineKey') }}: {{ mask(selected.machineKey) }}</p>
          <p>{{ t('nodes.nodeKey') }}: {{ mask(selected.nodeKey) }}</p>
          <p>{{ t('nodes.discoKey') }}: {{ mask(selected.discoKey) }}</p>
          <p>{{ t('nodes.registerMethod') }}: {{ selected.registerMethod }}</p>
        </template>
      </NDrawerContent>
    </NDrawer>
  </section>
</template>
