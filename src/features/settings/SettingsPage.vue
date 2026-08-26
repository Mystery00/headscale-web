<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NButton,
  NCheckbox,
  NFormItem,
  NInput,
  NRadio,
  NRadioGroup,
  NSelect,
  NSwitch,
  useMessage,
  useNotification,
} from 'naive-ui'
import { createHeadscaleHttp } from '@/api/http'
import type { CredentialPersistence } from '@/domain/credentials'
import { parseConnectionForm } from '@/features/connection/connection-schema'
import { createSystemRepository } from '@/repositories/system-repository'
import { credentialStore } from '@/stores/credentials'
import {
  POLLING_INTERVAL_PRESETS_MS,
  useSettingsStore,
  type DateTimeStyle,
  type LocaleCode,
  type ThemePreference,
} from '@/stores/settings'

const { t, locale } = useI18n()
const router = useRouter()
const message = useMessage()
const notification = useNotification()
const settings = useSettingsStore()
const baseUrl = ref(settings.baseUrl ?? '')
const apiKey = ref('')
const persistence = ref<CredentialPersistence>(settings.credentialPersistence)
const riskAccepted = ref(settings.credentialPersistence === 'local')
const testing = ref(false)

const intervalOptions = POLLING_INTERVAL_PRESETS_MS.map((ms) => ({
  label: `${ms / 1000}s`,
  value: ms,
}))
const localeOptions = [
  { label: 'English', value: 'en-US' },
  { label: '中文', value: 'zh-CN' },
]
const themeOptions = [
  { label: t('shell.themeLight'), value: 'light' },
  { label: t('shell.themeDark'), value: 'dark' },
  { label: t('shell.themeSystem'), value: 'system' },
]
const dateOptions = [
  { label: t('settings.absolute'), value: 'absolute' },
  { label: t('settings.relative'), value: 'relative' },
]

async function testConnection() {
  const parsed = parseConnectionForm({
    baseUrl: baseUrl.value,
    apiKey: apiKey.value || credentialStore.getApiKey() || '',
    persistence: persistence.value,
  })
  if (!parsed.ok) {
    notification.error({ title: t('common.failed') })
    return
  }
  testing.value = true
  try {
    await createSystemRepository(
      createHeadscaleHttp({
        getBaseUrl: () => parsed.value.baseUrl,
        getApiKey: () => parsed.value.apiKey,
      }),
    ).validateConnection()
    settings.update({
      baseUrl: parsed.value.baseUrl,
      credentialPersistence: parsed.value.persistence,
    })
    if (apiKey.value.trim()) {
      credentialStore.setApiKey(parsed.value.apiKey, parsed.value.persistence)
    }
    message.success(t('common.success'))
  } catch {
    notification.error({ title: t('common.failed') })
  } finally {
    testing.value = false
  }
}

function saveClientSettings() {
  settings.update({
    credentialPersistence: persistence.value,
    locale: settings.locale,
    theme: settings.theme,
    dateTimeStyle: settings.dateTimeStyle,
  })
  if (apiKey.value.trim()) {
    credentialStore.setApiKey(apiKey.value.trim(), persistence.value)
  }
  locale.value = settings.locale
  message.success(t('common.success'))
}

function disconnect() {
  credentialStore.clear()
  settings.update({ baseUrl: null, credentialPersistence: 'session' })
  void router.push('/connect')
}
</script>

<template>
  <section>
    <h1>{{ t('settings.title') }}</h1>
    <NFormItem :label="t('connection.urlLabel')">
      <NInput v-model:value="baseUrl" :input-props="{ 'aria-label': t('connection.urlLabel') }" />
    </NFormItem>
    <NFormItem :label="t('connection.apiKeyLabel')">
      <NInput
        v-model:value="apiKey"
        type="password"
        :input-props="{ 'aria-label': t('connection.apiKeyLabel') }"
      />
    </NFormItem>
    <NRadioGroup v-model:value="persistence">
      <NRadio value="session">{{ t('connection.persistenceSession') }}</NRadio>
      <NRadio value="local" :disabled="!riskAccepted">{{ t('connection.persistenceLocal') }}</NRadio>
    </NRadioGroup>
    <NCheckbox v-model:checked="riskAccepted">{{ t('connection.localRiskConfirm') }}</NCheckbox>
    <NFormItem :label="t('settings.polling')">
      <NSwitch
        :value="settings.pollingEnabled"
        :aria-label="t('settings.polling')"
        @update:value="settings.update({ pollingEnabled: $event })"
      />
    </NFormItem>
    <NFormItem :label="t('settings.interval')">
      <NSelect
        :value="settings.pollingIntervalMs"
        :options="intervalOptions"
        :aria-label="t('settings.interval')"
        @update:value="settings.update({ pollingIntervalMs: $event })"
      />
    </NFormItem>
    <NFormItem :label="t('shell.language')">
      <NSelect
        :value="settings.locale"
        :options="localeOptions"
        :aria-label="t('shell.language')"
        @update:value="(value: LocaleCode) => settings.update({ locale: value })"
      />
    </NFormItem>
    <NFormItem :label="t('shell.theme')">
      <NSelect
        :value="settings.theme"
        :options="themeOptions"
        :aria-label="t('shell.theme')"
        @update:value="(value: ThemePreference) => settings.update({ theme: value })"
      />
    </NFormItem>
    <NFormItem :label="t('settings.dateStyle')">
      <NSelect
        :value="settings.dateTimeStyle"
        :options="dateOptions"
        :aria-label="t('settings.dateStyle')"
        @update:value="(value: DateTimeStyle) => settings.update({ dateTimeStyle: value })"
      />
    </NFormItem>
    <div class="actions">
      <NButton :loading="testing" @click="testConnection">{{ t('settings.test') }}</NButton>
      <NButton type="primary" @click="saveClientSettings">{{ t('common.save') }}</NButton>
      <NButton type="error" @click="disconnect">{{ t('shell.disconnect') }}</NButton>
    </div>
  </section>
</template>

<style scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}
</style>
