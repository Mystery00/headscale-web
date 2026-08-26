<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NAlert, NButton, NCheckbox, NInput, NRadio, NRadioGroup } from 'naive-ui'
import { AppApiError } from '@/api/errors'
import { createHeadscaleHttp } from '@/api/http'
import type { CredentialPersistence } from '@/domain/credentials'
import { parseConnectionForm } from '@/features/connection/connection-schema'
import { createSystemRepository } from '@/repositories/system-repository'
import { credentialStore } from '@/stores/credentials'
import { useSettingsStore } from '@/stores/settings'

type StepName = 'network' | 'version' | 'database' | 'authorization'
type StepState = 'idle' | 'running' | 'ok' | 'fail'

const { t } = useI18n()
const router = useRouter()
const settings = useSettingsStore()

const baseUrl = ref(settings.baseUrl ?? '')
const apiKey = ref('')
const showKey = ref(false)
const persistence = ref<CredentialPersistence>('session')
const riskAccepted = ref(false)
const submitting = ref(false)
const errorMessage = ref<string | null>(null)
const steps = ref<Record<StepName, StepState>>({
  network: 'idle',
  version: 'idle',
  database: 'idle',
  authorization: 'idle',
})

const canSubmit = computed(() => !submitting.value)

function resetSteps() {
  steps.value = {
    network: 'idle',
    version: 'idle',
    database: 'idle',
    authorization: 'idle',
  }
}

function urlErrorMessage(reason: string): string {
  if (reason === 'empty') return t('connection.errors.empty')
  if (reason === 'invalid') return t('connection.errors.invalid')
  if (reason === 'unsupported-protocol') return t('connection.errors.unsupportedProtocol')
  if (reason === 'credentials-not-allowed') return t('connection.errors.credentialsNotAllowed')
  return t('connection.errors.unknown')
}

function errorFromKind(error: AppApiError): { step: StepName; message: string } {
  if (error.kind === 'network' || error.kind === 'timeout' || error.kind === 'cors') {
    const message =
      error.kind === 'timeout'
        ? t('connection.errors.timeout')
        : error.kind === 'cors'
          ? t('connection.errors.cors')
          : t('connection.errors.network')
    return { step: 'network', message }
  }
  if (error.kind === 'unsupported-version') {
    return { step: 'version', message: t('connection.errors.unsupportedVersion') }
  }
  if (error.kind === 'unauthorized' || error.kind === 'forbidden') {
    return { step: 'authorization', message: t('connection.errors.unauthorized') }
  }
  return { step: 'database', message: t('connection.errors.unknown') }
}

async function connect() {
  errorMessage.value = null
  resetSteps()
  const parsed = parseConnectionForm({
    baseUrl: baseUrl.value,
    apiKey: apiKey.value,
    persistence: persistence.value,
  })
  if (!parsed.ok) {
    errorMessage.value = urlErrorMessage(parsed.reason)
    return
  }

  submitting.value = true
  steps.value.network = 'running'
  const http = createHeadscaleHttp({
    getBaseUrl: () => parsed.value.baseUrl,
    getApiKey: () => parsed.value.apiKey,
  })
  const repository = createSystemRepository(http)

  try {
    const status = await repository.validateConnection()
    steps.value = {
      network: 'ok',
      version: 'ok',
      database: status.databaseConnectivity ? 'ok' : 'fail',
      authorization: 'ok',
    }
    settings.update({
      baseUrl: parsed.value.baseUrl,
      credentialPersistence: parsed.value.persistence,
    })
    credentialStore.setApiKey(parsed.value.apiKey, parsed.value.persistence)
    await router.push('/')
  } catch (error) {
    const mapped =
      error instanceof AppApiError
        ? errorFromKind(error)
        : { step: 'network' as const, message: t('connection.errors.unknown') }
    errorMessage.value = mapped.message
    steps.value.network = mapped.step === 'network' ? 'fail' : 'ok'
    steps.value.version =
      mapped.step === 'version' ? 'fail' : mapped.step === 'network' ? 'idle' : 'ok'
    steps.value.database =
      mapped.step === 'database' ? 'fail' : mapped.step === 'authorization' ? 'ok' : 'idle'
    steps.value.authorization = mapped.step === 'authorization' ? 'fail' : 'idle'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main>
    <h1>{{ t('connection.title') }}</h1>
    <form @submit.prevent="connect">
      <label>
        {{ t('connection.urlLabel') }}
        <NInput v-model:value="baseUrl" :input-props="{ 'aria-label': t('connection.urlLabel') }" />
      </label>
      <label>
        {{ t('connection.apiKeyLabel') }}
        <NInput
          v-model:value="apiKey"
          :type="showKey ? 'text' : 'password'"
          :input-props="{ 'aria-label': t('connection.apiKeyLabel') }"
        />
      </label>
      <NButton
        attr-type="button"
        quaternary
        @click="showKey = !showKey"
        :aria-label="showKey ? t('connection.hideApiKey') : t('connection.showApiKey')"
      >
        {{ showKey ? t('connection.hideApiKey') : t('connection.showApiKey') }}
      </NButton>
      <NRadioGroup v-model:value="persistence">
        <NRadio value="session">
          {{ t('connection.persistenceSession') }}
        </NRadio>
        <NRadio value="local" :disabled="!riskAccepted">
          {{ t('connection.persistenceLocal') }}
        </NRadio>
      </NRadioGroup>
      <p>{{ t('connection.localRisk') }}</p>
      <NCheckbox v-model:checked="riskAccepted">
        {{ t('connection.localRiskConfirm') }}
      </NCheckbox>
      <NButton type="primary" attr-type="submit" :disabled="!canSubmit" :loading="submitting">
        {{ submitting ? t('connection.connecting') : t('connection.connect') }}
      </NButton>
    </form>
    <ul>
      <li v-for="name in ['network', 'version', 'database', 'authorization'] as const" :key="name">
        {{ t(`connection.steps.${name}`) }}: {{ steps[name] }}
      </li>
    </ul>
    <NAlert v-if="errorMessage" type="error">
      {{ errorMessage }}
    </NAlert>
  </main>
</template>
