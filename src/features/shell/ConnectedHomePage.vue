<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createHeadscaleHttp } from '@/api/http'
import { createSystemRepository } from '@/repositories/system-repository'
import { credentialStore } from '@/stores/credentials'
import { useSettingsStore } from '@/stores/settings'
import type { SystemStatus } from '@/domain/system'

const { t } = useI18n()
const settings = useSettingsStore()
const status = ref<SystemStatus | null>(null)

onMounted(async () => {
  if (!settings.baseUrl) return
  const repository = createSystemRepository(
    createHeadscaleHttp({
      getBaseUrl: () => settings.baseUrl ?? '',
      getApiKey: () => credentialStore.getApiKey(),
    }),
  )
  status.value = await repository.validateConnection()
})
</script>

<template>
  <section>
    <p>{{ t('shell.version') }}: {{ status?.version }}</p>
    <p>
      {{
        status?.databaseConnectivity
          ? t('shell.databaseConnected')
          : t('shell.databaseDisconnected')
      }}
    </p>
  </section>
</template>
