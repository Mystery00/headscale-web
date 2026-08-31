<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
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
  NSpace,
  NSwitch,
  useMessage,
  useNotification,
} from 'naive-ui'
import { Brush, KeyRound, PlugZap, RefreshCw, Save, Unplug } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { createHeadscaleHttp } from '@/api/http'
import { apiKeyExpirationState } from '@/domain/api-key-status'
import type { CredentialPersistence } from '@/domain/credentials'
import { formatDateTime } from '@/domain/datetime'
import { parseConnectionForm } from '@/features/connection/connection-schema'
import { queryKeys } from '@/query/keys'
import { useCurrentApiKeyQuery } from '@/query/use-headscale-queries'
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
const queryClient = useQueryClient()
const message = useMessage()
const notification = useNotification()
const settings = useSettingsStore()
const baseUrl = ref(settings.baseUrl ?? '')
const apiKey = ref('')
const persistence = ref<CredentialPersistence>(settings.credentialPersistence)
const riskAccepted = ref(settings.credentialPersistence === 'local')
const testing = ref(false)
const confirmDisconnect = ref(false)
const showReplacementGuide = ref(false)
const currentApiKey = useCurrentApiKeyQuery()
const currentApiKeyState = computed(() =>
  currentApiKey.data.value
    ? apiKeyExpirationState(currentApiKey.data.value.expiration, new Date())
    : null,
)
const replacementNeeded = computed(
  () => currentApiKeyState.value === 'expiring-soon' || currentApiKeyState.value === 'expired',
)
const formattedExpiration = computed(() =>
  currentApiKey.data.value
    ? formatDateTime(currentApiKey.data.value.expiration, {
        locale: settings.locale,
        style: settings.dateTimeStyle,
      })
    : '-',
)

watch(riskAccepted, (accepted) => {
  if (!accepted && persistence.value === 'local') persistence.value = 'session'
})

const intervalOptions = POLLING_INTERVAL_PRESETS_MS.map((ms) => ({
  label: `${ms / 1000}s`,
  value: ms,
}))
const localeOptions = [
  { label: 'English', value: 'en-US' },
  { label: '中文', value: 'zh-CN' },
]
const themeOptions = computed(() => [
  { label: t('shell.themeLight'), value: 'light' },
  { label: t('shell.themeDark'), value: 'dark' },
  { label: t('shell.themeSystem'), value: 'system' },
])
const dateOptions = computed(() => [
  { label: t('settings.absolute'), value: 'absolute' },
  { label: t('settings.relative'), value: 'relative' },
])

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
    credentialStore.setApiKey(parsed.value.apiKey, parsed.value.persistence)
    apiKey.value = ''
    await queryClient.invalidateQueries({ queryKey: queryKeys.apiKeyStatus })
    message.success(t('settings.connectionVerified'))
  } catch {
    notification.error({ title: t('common.failed') })
  } finally {
    testing.value = false
  }
}

function saveClientSettings() {
  const parsed = parseConnectionForm({
    baseUrl: baseUrl.value,
    apiKey: apiKey.value || credentialStore.getApiKey() || '',
    persistence: persistence.value,
  })
  if (!parsed.ok) {
    notification.error({ title: t('common.failed') })
    return
  }
  settings.update({
    baseUrl: parsed.value.baseUrl,
    credentialPersistence: parsed.value.persistence,
    locale: settings.locale,
    theme: settings.theme,
    dateTimeStyle: settings.dateTimeStyle,
  })
  credentialStore.setApiKey(parsed.value.apiKey, parsed.value.persistence)
  apiKey.value = ''
  locale.value = settings.locale
  void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeyStatus })
  message.success(t('common.success'))
}

function disconnect() {
  credentialStore.clear()
  settings.update({ baseUrl: null, credentialPersistence: 'session' })
  queryClient.clear()
  confirmDisconnect.value = false
  void router.push('/connect')
}
</script>

<template>
  <section class="admin-page settings-page">
    <PageHeader :title="t('settings.title')" :description="t('settings.description')" />

    <div class="settings-grid">
      <section
        class="admin-card settings-card settings-card--wide"
        role="region"
        :aria-label="t('settings.connectionSection')"
      >
        <header class="card-heading">
          <div class="card-icon"><PlugZap :size="20" aria-hidden="true" /></div>
          <div>
            <h2>{{ t('settings.connectionSection') }}</h2>
            <p>{{ t('settings.connectionHint') }}</p>
          </div>
        </header>
        <div class="form-grid">
          <NFormItem :label="t('connection.urlLabel')"
            ><NInput
              v-model:value="baseUrl"
              :input-props="{ 'aria-label': t('connection.urlLabel') }"
          /></NFormItem>
          <NFormItem :label="t('connection.apiKeyLabel')"
            ><NInput
              v-model:value="apiKey"
              type="password"
              show-password-on="click"
              :placeholder="t('settings.apiKeyReplacement')"
              :input-props="{
                'aria-label': t('connection.apiKeyLabel'),
                autocomplete: 'new-password',
              }"
          /></NFormItem>
        </div>
        <div class="storage-row">
          <NRadioGroup v-model:value="persistence">
            <NSpace
              ><NRadio value="session">{{ t('connection.persistenceSession') }}</NRadio
              ><NRadio value="local" :disabled="!riskAccepted">{{
                t('connection.persistenceLocal')
              }}</NRadio></NSpace
            >
          </NRadioGroup>
          <NCheckbox v-model:checked="riskAccepted">{{
            t('connection.localRiskConfirm')
          }}</NCheckbox>
        </div>
        <NSpace justify="end"
          ><NButton :loading="testing" @click="testConnection">{{ t('settings.test') }}</NButton
          ><NButton type="primary" @click="saveClientSettings"
            ><template #icon><Save :size="16" aria-hidden="true" /></template
            >{{ t('common.save') }}</NButton
          ></NSpace
        >
      </section>

      <section
        class="admin-card settings-card settings-card--wide"
        role="region"
        :aria-label="t('settings.apiKeyStatus.title')"
      >
        <header class="card-heading">
          <div class="card-icon"><KeyRound :size="20" aria-hidden="true" /></div>
          <div>
            <h2>{{ t('settings.apiKeyStatus.title') }}</h2>
            <p>{{ t('settings.apiKeyStatus.hint') }}</p>
          </div>
        </header>
        <p v-if="currentApiKey.isPending.value" class="status-message">
          {{ t('settings.apiKeyStatus.loading') }}
        </p>
        <p
          v-else-if="currentApiKey.isError.value || !currentApiKey.data.value"
          class="status-message status-message--muted"
        >
          {{ t('settings.apiKeyStatus.unavailable') }}
        </p>
        <template v-else>
          <div class="api-key-summary">
            <div>
              <span>{{ t('settings.apiKeyStatus.prefix') }}</span>
              <strong>{{ currentApiKey.data.value.displayPrefix }}</strong>
            </div>
            <div>
              <span>{{ t('settings.apiKeyStatus.expiration') }}</span>
              <strong>{{ formattedExpiration }}</strong>
            </div>
            <div>
              <span>{{ t('settings.apiKeyStatus.state') }}</span>
              <strong :class="`api-key-state api-key-state--${currentApiKeyState}`">
                {{ t(`settings.apiKeyStatus.states.${currentApiKeyState}`) }}
              </strong>
            </div>
          </div>
          <div v-if="replacementNeeded" class="replacement-panel">
            <NButton secondary type="warning" @click="showReplacementGuide = !showReplacementGuide">
              {{ t('settings.apiKeyStatus.replace') }}
            </NButton>
            <div v-if="showReplacementGuide" class="replacement-guide">
              <p>{{ t('settings.apiKeyStatus.replaceHint') }}</p>
              <ol>
                <li>{{ t('settings.apiKeyStatus.steps.create') }}</li>
                <li>{{ t('settings.apiKeyStatus.steps.test') }}</li>
                <li>{{ t('settings.apiKeyStatus.steps.save') }}</li>
                <li>{{ t('settings.apiKeyStatus.steps.expire') }}</li>
              </ol>
              <code>headscale apikeys create --expiration 90d</code>
              <code
                >headscale apikeys expire --prefix {{ currentApiKey.data.value.rawPrefix }}</code
              >
              <p class="status-message status-message--muted">
                {{ t('settings.apiKeyStatus.oneTimeWarning') }}
              </p>
            </div>
          </div>
        </template>
      </section>

      <section
        class="admin-card settings-card"
        role="region"
        :aria-label="t('settings.refreshSection')"
      >
        <header class="card-heading">
          <div class="card-icon"><RefreshCw :size="20" aria-hidden="true" /></div>
          <div>
            <h2>{{ t('settings.refreshSection') }}</h2>
            <p>{{ t('settings.refreshHint') }}</p>
          </div>
        </header>
        <div class="setting-row">
          <div>
            <strong>{{ t('settings.polling') }}</strong
            ><span>{{ t('settings.pollingHint') }}</span>
          </div>
          <NSwitch
            :value="settings.pollingEnabled"
            :aria-label="t('settings.polling')"
            @update:value="settings.update({ pollingEnabled: $event })"
          />
        </div>
        <NFormItem :label="t('settings.interval')"
          ><NSelect
            :value="settings.pollingIntervalMs"
            :options="intervalOptions"
            :aria-label="t('settings.interval')"
            :disabled="!settings.pollingEnabled"
            @update:value="settings.update({ pollingIntervalMs: $event })"
        /></NFormItem>
      </section>

      <section
        class="admin-card settings-card"
        role="region"
        :aria-label="t('settings.appearanceSection')"
      >
        <header class="card-heading">
          <div class="card-icon"><Brush :size="20" aria-hidden="true" /></div>
          <div>
            <h2>{{ t('settings.appearanceSection') }}</h2>
            <p>{{ t('settings.appearanceHint') }}</p>
          </div>
        </header>
        <NFormItem :label="t('shell.language')"
          ><NSelect
            :value="settings.locale"
            :options="localeOptions"
            :aria-label="t('shell.language')"
            @update:value="(value: LocaleCode) => settings.update({ locale: value })"
        /></NFormItem>
        <NFormItem :label="t('shell.theme')"
          ><NSelect
            :value="settings.theme"
            :options="themeOptions"
            :aria-label="t('shell.theme')"
            @update:value="(value: ThemePreference) => settings.update({ theme: value })"
        /></NFormItem>
        <NFormItem :label="t('settings.dateStyle')"
          ><NSelect
            :value="settings.dateTimeStyle"
            :options="dateOptions"
            :aria-label="t('settings.dateStyle')"
            @update:value="(value: DateTimeStyle) => settings.update({ dateTimeStyle: value })"
        /></NFormItem>
      </section>
    </div>

    <section class="danger-card" role="region" :aria-label="t('settings.dangerSection')">
      <div>
        <h2>{{ t('settings.dangerSection') }}</h2>
        <p>{{ t('settings.disconnectHint') }}</p>
      </div>
      <NButton type="error" secondary @click="confirmDisconnect = true"
        ><template #icon><Unplug :size="16" aria-hidden="true" /></template
        >{{ t('shell.disconnect') }}</NButton
      >
    </section>

    <ConfirmDialog
      v-model:show="confirmDisconnect"
      :title="t('shell.disconnect')"
      :message="t('settings.disconnectMessage')"
      :confirm-label="t('shell.disconnect')"
      danger
      @confirm="disconnect"
    />
  </section>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.settings-card {
  display: grid;
  gap: 1rem;
  align-content: start;
  padding: 1.15rem;
}
.settings-card--wide {
  grid-column: 1 / -1;
}
.card-heading {
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
}
.card-icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.75rem;
  color: var(--admin-primary);
  background: var(--admin-primary-soft);
}
.card-heading h2,
.danger-card h2 {
  margin: 0;
  color: var(--admin-text);
  font-size: 1rem;
}
.card-heading p,
.danger-card p {
  margin: 0.25rem 0 0;
  color: var(--admin-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 1rem;
}
.storage-row {
  display: grid;
  gap: 0.75rem;
  padding: 0.9rem;
  border-radius: 0.75rem;
  background: var(--admin-surface-muted);
}
.setting-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}
.setting-row > div {
  display: grid;
  gap: 0.2rem;
}
.setting-row strong {
  color: var(--admin-text);
  font-size: 0.85rem;
}
.setting-row span {
  color: var(--admin-muted);
  font-size: 0.75rem;
}
.danger-card {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--admin-danger) 35%, var(--admin-border));
  border-radius: var(--admin-radius);
  background: color-mix(in srgb, var(--admin-danger) 5%, var(--admin-surface));
}
.api-key-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}
.api-key-summary > div {
  display: grid;
  gap: 0.3rem;
  padding: 0.8rem;
  border-radius: 0.7rem;
  background: var(--admin-surface-muted);
}
.api-key-summary span,
.status-message {
  color: var(--admin-muted);
  font-size: 0.75rem;
}
.api-key-summary strong {
  overflow-wrap: anywhere;
  color: var(--admin-text);
  font-size: 0.85rem;
}
.api-key-state--healthy,
.api-key-state--no-expiration {
  color: var(--admin-primary) !important;
}
.api-key-state--expiring-soon {
  color: var(--admin-warning, #d97706) !important;
}
.api-key-state--expired {
  color: var(--admin-danger) !important;
}
.status-message {
  margin: 0;
}
.status-message--muted {
  line-height: 1.5;
}
.replacement-panel,
.replacement-guide {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}
.replacement-guide {
  width: 100%;
  padding: 0.9rem;
  border-radius: 0.75rem;
  background: var(--admin-surface-muted);
}
.replacement-guide p,
.replacement-guide ol {
  margin: 0;
  color: var(--admin-muted);
  font-size: 0.78rem;
  line-height: 1.55;
}
.replacement-guide code {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  padding: 0.55rem 0.7rem;
  border-radius: 0.45rem;
  color: var(--admin-text);
  background: var(--admin-surface);
}

@media (max-width: 760px) {
  .settings-grid,
  .form-grid,
  .api-key-summary {
    grid-template-columns: 1fr;
  }
  .danger-card {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
