<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NAlert, NButton, NCheckbox, NInput, NRadio } from 'naive-ui'
import {
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Server,
  ShieldCheck,
  XCircle,
} from '@lucide/vue'
import { AppApiError } from '@/api/errors'
import { createHeadscaleHttp } from '@/api/http'
import { appVersion } from '@/config/app'
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
const brandIconSrc = `${import.meta.env.BASE_URL}favicon.svg`

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

const stepNames: StepName[] = ['network', 'version', 'database', 'authorization']
const canSubmit = computed(() => !submitting.value)
const isDark = computed(
  () =>
    settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
)

watch(riskAccepted, (accepted) => {
  if (!accepted && persistence.value === 'local') persistence.value = 'session'
})

function selectPersistence(value: CredentialPersistence, checked: boolean) {
  if (checked) persistence.value = value
}

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
  <main class="connection-page" :class="{ 'connection-page--dark': isDark }">
    <div class="ambient ambient--one" aria-hidden="true"></div>
    <div class="ambient ambient--two" aria-hidden="true"></div>

    <section class="connection-card">
      <div class="brand-panel">
        <div class="brand-mark" aria-hidden="true">
          <img :src="brandIconSrc" width="40" height="40" alt="" />
        </div>
        <div class="brand-copy">
          <p class="eyebrow">
            <span>{{ t('app.title') }}</span>
            <span class="app-version">{{ appVersion }}</span>
          </p>
          <h1>{{ t('connection.title') }}</h1>
          <p class="description">{{ t('connection.description') }}</p>
        </div>
        <div class="security-note">
          <ShieldCheck :size="20" aria-hidden="true" />
          <div>
            <strong>{{ t('connection.securityTitle') }}</strong>
            <span>{{ t('connection.securityDescription') }}</span>
          </div>
        </div>
      </div>

      <div class="form-panel">
        <form class="connection-form" @submit.prevent="connect">
          <div class="field-group">
            <label for="headscale-url">{{ t('connection.urlLabel') }}</label>
            <NInput
              v-model:value="baseUrl"
              size="large"
              :placeholder="t('connection.urlPlaceholder')"
              :input-props="{
                id: 'headscale-url',
                'aria-label': t('connection.urlLabel'),
                autocomplete: 'url',
                spellcheck: 'false',
              }"
            >
              <template #prefix>
                <Server :size="18" aria-hidden="true" />
              </template>
            </NInput>
          </div>

          <div class="field-group">
            <label for="api-key">{{ t('connection.apiKeyLabel') }}</label>
            <NInput
              v-model:value="apiKey"
              size="large"
              :type="showKey ? 'text' : 'password'"
              :placeholder="t('connection.apiKeyPlaceholder')"
              :input-props="{
                id: 'api-key',
                'aria-label': t('connection.apiKeyLabel'),
                autocomplete: 'current-password',
                spellcheck: 'false',
              }"
            >
              <template #prefix>
                <KeyRound :size="18" aria-hidden="true" />
              </template>
              <template #suffix>
                <button
                  class="visibility-button"
                  type="button"
                  :aria-label="showKey ? t('connection.hideApiKey') : t('connection.showApiKey')"
                  @click="showKey = !showKey"
                >
                  <EyeOff v-if="showKey" :size="18" aria-hidden="true" />
                  <Eye v-else :size="18" aria-hidden="true" />
                </button>
              </template>
            </NInput>
          </div>

          <fieldset class="storage-fieldset">
            <legend>{{ t('connection.persistenceTitle') }}</legend>
            <div class="storage-options">
              <div
                class="storage-option"
                :class="{ 'storage-option--selected': persistence === 'session' }"
              >
                <NRadio
                  value="session"
                  :checked="persistence === 'session'"
                  @update:checked="selectPersistence('session', $event)"
                >
                  <span class="storage-label">{{ t('connection.persistenceSession') }}</span>
                </NRadio>
                <span class="storage-detail">{{ t('connection.persistenceSessionHint') }}</span>
              </div>
              <div
                class="storage-option"
                :class="{
                  'storage-option--selected': persistence === 'local',
                  'storage-option--disabled': !riskAccepted,
                }"
              >
                <NRadio
                  value="local"
                  :checked="persistence === 'local'"
                  :disabled="!riskAccepted"
                  @update:checked="selectPersistence('local', $event)"
                >
                  <span class="storage-label">{{ t('connection.persistenceLocal') }}</span>
                </NRadio>
                <span class="storage-detail">{{ t('connection.persistenceLocalHint') }}</span>
              </div>
            </div>
          </fieldset>

          <div class="risk-box">
            <p>{{ t('connection.localRisk') }}</p>
            <NCheckbox v-model:checked="riskAccepted">
              {{ t('connection.localRiskConfirm') }}
            </NCheckbox>
          </div>

          <NAlert v-if="errorMessage" type="error" :bordered="false">
            {{ errorMessage }}
          </NAlert>

          <NButton
            class="connect-button"
            type="primary"
            attr-type="submit"
            size="large"
            :disabled="!canSubmit"
            :loading="submitting"
          >
            {{ submitting ? t('connection.connecting') : t('connection.connect') }}
          </NButton>
        </form>

        <section
          class="checks-panel"
          role="region"
          :aria-label="t('connection.checksTitle')"
          aria-live="polite"
        >
          <div class="checks-heading">
            <span>{{ t('connection.checksTitle') }}</span>
            <span class="checks-caption">{{ t('connection.checksHint') }}</span>
          </div>
          <ul class="checks-list">
            <li v-for="name in stepNames" :key="name" :class="`check--${steps[name]}`">
              <span class="check-icon" aria-hidden="true">
                <LoaderCircle v-if="steps[name] === 'running'" class="spin" :size="17" />
                <CheckCircle2 v-else-if="steps[name] === 'ok'" :size="17" />
                <XCircle v-else-if="steps[name] === 'fail'" :size="17" />
                <Circle v-else :size="17" />
              </span>
              <span class="check-name">{{ t(`connection.steps.${name}`) }}</span>
              <span class="check-state">{{ t(`connection.states.${steps[name]}`) }}</span>
            </li>
          </ul>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.connection-page {
  --page-bg: #f1f5f9;
  --card-bg: rgba(255, 255, 255, 0.94);
  --panel-bg: #f8fafc;
  --text: #102235;
  --muted: #64748b;
  --line: #e2e8f0;
  --primary: #0f9f78;
  --primary-dark: #08775b;
  --primary-soft: #e7f8f2;
  --danger: #dc4c64;
  position: relative;
  display: grid;
  min-height: 100vh;
  place-items: center;
  overflow: hidden;
  padding: 40px 24px;
  color: var(--text);
  background:
    radial-gradient(circle at 12% 16%, rgba(20, 184, 166, 0.11), transparent 28%),
    radial-gradient(circle at 88% 84%, rgba(59, 130, 246, 0.09), transparent 30%), var(--page-bg);
}

.connection-page--dark {
  --page-bg: #08111d;
  --card-bg: rgba(15, 27, 42, 0.96);
  --panel-bg: #111f31;
  --text: #edf5f7;
  --muted: #94a3b8;
  --line: #25364b;
  --primary: #35d0a3;
  --primary-dark: #1aaf86;
  --primary-soft: rgba(53, 208, 163, 0.12);
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(2px);
  pointer-events: none;
}

.ambient--one {
  top: -160px;
  left: -120px;
  width: 360px;
  height: 360px;
  border: 1px solid rgba(15, 159, 120, 0.12);
}

.ambient--two {
  right: -100px;
  bottom: -180px;
  width: 420px;
  height: 420px;
  border: 1px solid rgba(59, 130, 246, 0.1);
}

.connection-card {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(270px, 0.82fr) minmax(400px, 1.18fr);
  width: min(960px, 100%);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 24px;
  background: var(--card-bg);
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(18px);
}

.brand-panel {
  display: flex;
  min-height: 650px;
  flex-direction: column;
  padding: 48px 42px;
  color: #effcf8;
  background: linear-gradient(155deg, rgba(6, 95, 70, 0.97), rgba(15, 118, 110, 0.94)), #08775b;
}

.brand-mark {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.brand-mark img {
  display: block;
  width: 40px;
  height: 40px;
}

.brand-copy {
  margin-top: 72px;
}

.eyebrow {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  margin: 0 0 14px;
  color: rgba(236, 253, 245, 0.72);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.app-version {
  padding: 0.18rem 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  color: rgba(236, 253, 245, 0.9);
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: none;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.75rem);
  line-height: 1.08;
  letter-spacing: -0.04em;
}

.description {
  max-width: 310px;
  margin: 20px 0 0;
  color: rgba(236, 253, 245, 0.78);
  font-size: 0.98rem;
  line-height: 1.75;
}

.security-note {
  display: flex;
  gap: 13px;
  align-items: flex-start;
  margin-top: auto;
  padding: 17px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.1);
}

.security-note svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #86efcf;
}

.security-note strong,
.security-note span {
  display: block;
}

.security-note strong {
  margin-bottom: 4px;
  font-size: 0.86rem;
}

.security-note span {
  color: rgba(236, 253, 245, 0.68);
  font-size: 0.76rem;
  line-height: 1.5;
}

.form-panel {
  padding: 42px 46px;
}

.connection-form {
  display: grid;
  gap: 22px;
}

.field-group {
  display: grid;
  gap: 8px;
}

.field-group label,
.storage-fieldset legend {
  color: var(--text);
  font-size: 0.86rem;
  font-weight: 650;
}

:deep(.n-input) {
  --n-border-radius: 10px !important;
}

:deep(.n-input .n-input__input-el) {
  font-size: 0.92rem;
}

.visibility-button {
  display: grid;
  width: 30px;
  height: 30px;
  cursor: pointer;
  place-items: center;
  border: 0;
  border-radius: 7px;
  color: var(--muted);
  background: transparent;
}

.visibility-button:hover,
.visibility-button:focus-visible {
  color: var(--primary);
  background: var(--primary-soft);
  outline: none;
}

.storage-fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.storage-fieldset legend {
  margin-bottom: 10px;
}

.storage-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.storage-option {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 13px 14px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--panel-bg);
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.storage-option--selected {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.storage-option--disabled {
  opacity: 0.58;
}

.storage-label {
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 600;
}

.storage-detail {
  padding-left: 24px;
  color: var(--muted);
  font-size: 0.71rem;
  line-height: 1.35;
}

.risk-box {
  padding: 13px 15px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--panel-bg);
}

.risk-box p {
  margin: 0 0 9px;
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

:deep(.risk-box .n-checkbox__label) {
  color: var(--text);
  font-size: 0.78rem;
}

.connect-button {
  width: 100%;
  margin-top: 2px;
  font-weight: 650;
}

.checks-panel {
  margin-top: 26px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
}

.checks-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 650;
}

.checks-caption {
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 400;
}

.checks-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.checks-list li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1px 7px;
  align-items: center;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-bg);
}

.check-icon {
  display: grid;
  grid-row: 1 / 3;
  color: #94a3b8;
}

.check-name {
  overflow: hidden;
  color: var(--text);
  font-size: 0.73rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check-state {
  color: var(--muted);
  font-size: 0.65rem;
}

.check--running .check-icon {
  color: #3b82f6;
}

.check--ok .check-icon {
  color: var(--primary);
}

.check--fail .check-icon {
  color: var(--danger);
}

.spin {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 780px) {
  .connection-page {
    align-items: start;
    padding: 20px;
  }

  .connection-card {
    grid-template-columns: 1fr;
    max-width: 580px;
    border-radius: 20px;
  }

  .brand-panel {
    min-height: auto;
    padding: 28px;
  }

  .brand-copy {
    margin-top: 28px;
  }

  .description {
    max-width: none;
    margin-top: 12px;
  }

  .security-note {
    margin-top: 24px;
  }

  .form-panel {
    padding: 30px 28px 34px;
  }
}

@media (max-width: 520px) {
  .connection-page {
    padding: 0;
    background: var(--card-bg);
  }

  .connection-card {
    min-height: 100vh;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .brand-panel,
  .form-panel {
    padding-right: 22px;
    padding-left: 22px;
  }

  .brand-panel {
    padding-top: 24px;
    padding-bottom: 24px;
  }

  .brand-copy {
    margin-top: 22px;
  }

  .security-note {
    display: none;
  }

  .storage-options,
  .checks-list {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
