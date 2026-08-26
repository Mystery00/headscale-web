<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NSelect, NSpin } from 'naive-ui'
import { usePreAuthKeysQuery } from '@/query/use-headscale-queries'
import type { PreAuthKeyState } from '@/domain/preauth-key'

const { t } = useI18n()
const query = usePreAuthKeysQuery()
const state = ref<PreAuthKeyState | 'all'>('all')
const filtered = computed(() =>
  (query.data.value ?? []).filter((key) => state.value === 'all' || key.state === state.value),
)
const options = computed(() => [
  { label: t('routes.filterAll'), value: 'all' },
  { label: t('preAuthKeys.active'), value: 'active' },
  { label: t('preAuthKeys.used'), value: 'used' },
  { label: t('preAuthKeys.expired'), value: 'expired' },
])
</script>

<template>
  <section>
    <h1>{{ t('preAuthKeys.title') }}</h1>
    <NSelect
      v-model:value="state"
      :options="options"
      :aria-label="t('common.filter')"
      style="max-width: 16rem"
    />
    <NAlert v-if="query.isError.value" type="error">{{ t('common.error') }}</NAlert>
    <NSpin :show="query.isLoading.value">
      <p v-if="!query.isLoading.value && filtered.length === 0">{{ t('common.empty') }}</p>
      <table v-else>
        <thead>
          <tr>
            <th>{{ t('preAuthKeys.key') }}</th>
            <th>{{ t('preAuthKeys.user') }}</th>
            <th>{{ t('preAuthKeys.state') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in filtered" :key="key.id">
            <td>{{ key.keyPreview }}</td>
            <td>{{ key.user?.name ?? '—' }}</td>
            <td>{{ t(`preAuthKeys.${key.state}`) }}</td>
          </tr>
        </tbody>
      </table>
    </NSpin>
  </section>
</template>
