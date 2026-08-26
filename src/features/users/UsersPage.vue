<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NDrawer, NDrawerContent, NInput, NSelect, NSpin } from 'naive-ui'
import type { User } from '@/domain/user'
import { useUsersQuery } from '@/query/use-headscale-queries'

const { t } = useI18n()
const query = useUsersQuery()
const search = ref('')
const provider = ref<string | null>(null)
const selected = ref<User | null>(null)

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
</script>

<template>
  <section>
    <h1>{{ t('users.title') }}</h1>
    <div class="toolbar">
      <NInput
        v-model:value="search"
        :placeholder="t('common.search')"
        :aria-label="t('common.search')"
      />
      <NSelect
        :value="provider ?? ''"
        :options="providers"
        :aria-label="t('users.provider')"
        @update:value="provider = $event || null"
      />
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
            <td>
              <button type="button" @click="selected = user">{{ user.name }}</button>
            </td>
            <td>{{ user.email }}</td>
            <td>{{ user.provider }}</td>
          </tr>
        </tbody>
      </table>
    </NSpin>
    <NDrawer
      :show="Boolean(selected)"
      @update:show="(value: boolean) => !value && (selected = null)"
    >
      <NDrawerContent :title="t('common.details')">
        <p v-if="selected">{{ selected.displayName || selected.name }}</p>
        <p v-if="selected">{{ selected.email }}</p>
        <p v-if="selected">{{ selected.provider }}</p>
      </NDrawerContent>
    </NDrawer>
  </section>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  max-width: 40rem;
}
</style>
