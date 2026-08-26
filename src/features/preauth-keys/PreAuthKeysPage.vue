<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NButton, NCheckbox, NInput, NModal, NSelect, NSpin, useMessage, useNotification } from 'naive-ui'
import { normalizeTags } from '@/domain/tags'
import type { PreAuthKeyState } from '@/domain/preauth-key'
import { usePreAuthKeysQuery, useUsersQuery } from '@/query/use-headscale-queries'
import { useCreatePreAuthKeyMutation, useDeletePreAuthKeyMutation, useExpirePreAuthKeyMutation } from '@/query/use-headscale-mutations'

const { t } = useI18n()
const message = useMessage()
const notification = useNotification()
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
const filtered = computed(() => (query.data.value ?? []).filter((key) => state.value === 'all' || key.state === state.value))
const userOptions = computed(() => (users.data.value ?? []).map((user) => ({ label: user.name, value: user.id })))
const options = computed(() => [
  { label: t('routes.filterAll'), value: 'all' },
  { label: t('preAuthKeys.active'), value: 'active' },
  { label: t('preAuthKeys.used'), value: 'used' },
  { label: t('preAuthKeys.expired'), value: 'expired' },
])

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
</script>

<template>
  <section>
    <h1>{{ t('preAuthKeys.title') }}</h1>
    <div class="toolbar">
      <NSelect v-model:value="state" :options="options" :aria-label="t('common.filter')" style="max-width: 16rem" />
      <NButton type="primary" @click="creating = true">{{ t('common.create') }}</NButton>
    </div>
    <NAlert v-if="query.isError.value" type="error">{{ t('common.error') }}</NAlert>
    <NSpin :show="query.isLoading.value">
      <p v-if="!query.isLoading.value && filtered.length === 0">{{ t('common.empty') }}</p>
      <table v-else>
        <thead>
          <tr>
            <th>{{ t('preAuthKeys.key') }}</th>
            <th>{{ t('preAuthKeys.user') }}</th>
            <th>{{ t('preAuthKeys.state') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="key in filtered" :key="key.id">
            <td>{{ key.keyPreview }}</td>
            <td>{{ key.user?.name ?? '—' }}</td>
            <td>{{ t(`preAuthKeys.${key.state}`) }}</td>
            <td>
              <NButton size="small" :disabled="expireKey.isPending.value" @click="expireKey.mutate(key.id)">{{ t('common.expire') }}</NButton>
              <NButton size="small" type="error" :disabled="deleteKey.isPending.value" @click="deleteKey.mutate(key.id)">{{ t('common.delete') }}</NButton>
            </td>
          </tr>
        </tbody>
      </table>
    </NSpin>
    <NModal v-model:show="creating" :title="t('common.create')">
      <div class="dialog">
        <NSelect v-model:value="userId" :options="userOptions" :aria-label="t('preAuthKeys.user')" />
        <NCheckbox v-model:checked="reusable">{{ t('preAuthKeys.reusable') }}</NCheckbox>
        <NCheckbox v-model:checked="ephemeral">{{ t('preAuthKeys.ephemeral') }}</NCheckbox>
        <NInput v-model:value="tags" :aria-label="t('nodes.tags')" />
        <NButton type="primary" :disabled="!userId || createKey.isPending.value" @click="onCreate">{{ t('common.save') }}</NButton>
      </div>
    </NModal>
    <NModal :show="Boolean(plaintext)" :mask-closable="false" :closable="false">
      <div class="dialog" v-if="plaintext">
        <p>{{ t('preAuthKeys.plaintextWarning') }}</p>
        <code>{{ plaintext }}</code>
        <NButton @click="copyPlaintext">{{ t('common.copy') }}</NButton>
        <NCheckbox v-model:checked="saved">{{ t('preAuthKeys.savedConfirm') }}</NCheckbox>
        <NButton type="primary" :disabled="!saved" @click="closePlaintext()">{{ t('common.close') }}</NButton>
        <NButton @click="closePlaintext(true)">{{ t('preAuthKeys.forceClose') }}</NButton>
      </div>
    </NModal>
  </section>
</template>

<style scoped>
.toolbar, .dialog { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; }
</style>
