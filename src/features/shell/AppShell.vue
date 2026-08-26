<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NButton, NLayout, NLayoutContent, NLayoutHeader } from 'naive-ui'
import { credentialStore } from '@/stores/credentials'
import { useSettingsStore } from '@/stores/settings'

const { t } = useI18n()
const router = useRouter()
const settings = useSettingsStore()
const title = computed(() => t('app.title'))

function disconnect() {
  credentialStore.clear()
  settings.update({ baseUrl: null, credentialPersistence: 'session' })
  void router.push('/connect')
}
</script>

<template>
  <NLayout>
    <NLayoutHeader>
      <strong>{{ title }}</strong>
      <span>{{ settings.baseUrl }}</span>
      <NButton @click="disconnect">{{ t('shell.disconnect') }}</NButton>
    </NLayoutHeader>
    <NLayoutContent>
      <router-view />
    </NLayoutContent>
  </NLayout>
</template>
