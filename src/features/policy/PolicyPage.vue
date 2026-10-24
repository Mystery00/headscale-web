<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NAlert, NButton, NSpin, useMessage } from 'naive-ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { getApiErrorMessage } from '@/api/errors'
import { editPolicy, type PolicyPath } from '@/domain/policy-document'
import { createAppRepositories } from '@/query/repositories'
import { useSettingsStore } from '@/stores/settings'
import { credentialStore } from '@/stores/credentials'
import { createPolicyWorkbench } from './policy-workbench'
import { policyFields, policySections } from './policy-fields'
import PolicyField from './PolicyField.vue'
import './policy.css'

const { t } = useI18n()
const message = useMessage()
const settings = useSettingsStore()
const connection = { url: settings.baseUrl, key: credentialStore.getApiKey() }
const repository = createAppRepositories().policy
function requireConnection() {
  if (settings.baseUrl !== connection.url || credentialStore.getApiKey() !== connection.key)
    throw new Error('PolicyConnectionChanged')
}
const workspace = createPolicyWorkbench({
  get: () => {
    requireConnection()
    return repository.get()
  },
  check: (text) => {
    requireConnection()
    return repository.check(text)
  },
  set: (text) => {
    requireConnection()
    return repository.set(text)
  },
})
const { draft, baseline, busy, loaded, dirty, parsed, validated, uncertain } = workspace
const view = ref('visual')
const section = ref<(typeof policySections)[number]['id']>('access')
const database = ref(false)
const error = ref('')
const confirm = ref(false)
const invalidFields = ref(new Set<string>())
const formEpoch = ref(0)
const buffered = computed(() => invalidFields.value.size > 0)
const activeSection = computed(() => policySections.find((item) => item.id === section.value)!)
const unknownKeys = computed(() =>
  Object.keys(parsed.value.value ?? {}).filter((key) => !Object.hasOwn(policyFields, key)),
)
const canCheck = computed(
  () => loaded.value && !busy.value && !parsed.value.error && !buffered.value && !uncertain.value,
)
const canPublish = computed(
  () => canCheck.value && dirty.value && validated.value && database.value,
)
function errorText(reason: unknown) {
  const known: Record<string, string> = {
    PolicyConflict: 'conflict',
    PolicyDraftChanged: 'draftChanged',
    PolicyConnectionChanged: 'connectionChanged',
  }
  if (reason instanceof Error && known[reason.message]) return t(`policy.${known[reason.message]}`)
  return getApiErrorMessage(reason) ?? t('policy.failed')
}
async function run(action: () => Promise<void>) {
  error.value = ''
  try {
    await action()
  } catch (reason) {
    error.value = errorText(reason)
  }
}
async function reload() {
  if ((dirty.value || buffered.value) && !window.confirm(t('policy.discard'))) return
  await run(async () => {
    await workspace.load()
    invalidFields.value = new Set()
    formEpoch.value++
  })
}
function edit(path: PolicyPath, value: unknown) {
  if (busy.value) return
  try {
    draft.value = editPolicy(draft.value, path, value)
    error.value = ''
    // 删除父字段后同步清理子字段的输入错误。
    if (value === undefined)
      invalidFields.value = new Set(
        [...invalidFields.value].filter(
          (key) => key !== path.join('.') && !key.startsWith(`${path.join('.')}.`),
        ),
      )
  } catch (reason) {
    error.value = errorText(reason)
  }
}
function invalid(path: string, value: boolean) {
  const next = new Set(invalidFields.value)
  if (value) next.add(path)
  else next.delete(path)
  invalidFields.value = next
}
function changeView(next: string) {
  if (!buffered.value) view.value = next
}
function openSection(id: (typeof policySections)[number]['id']) {
  section.value = id
  view.value = 'visual'
}
function exportDraft() {
  const url = URL.createObjectURL(new Blob([draft.value], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'headscale-policy.hujson'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function publish() {
  if (!canPublish.value) {
    confirm.value = false
    return
  }
  await run(async () => {
    await workspace.save()
    message.success(t('policy.saved'))
  })
  confirm.value = false
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || buffered.value || busy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(
  () => !busy.value && (!(dirty.value || buffered.value) || window.confirm(t('policy.leave'))),
)
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void run(workspace.load)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <section class="admin-page policy-page">
    <PageHeader :title="t('policy.title')" :description="t('policy.description')">
      <template #actions>
        <NButton :disabled="busy" @click="reload">{{ t('policy.reload') }}</NButton>
        <NButton :disabled="!loaded || buffered" @click="exportDraft">{{
          t('policy.export')
        }}</NButton>
        <NButton :disabled="!canCheck" :loading="busy" @click="run(workspace.check)">{{
          t('policy.check')
        }}</NButton>
        <NButton type="primary" :disabled="!loaded || buffered" @click="changeView('review')">{{
          t('policy.review')
        }}</NButton>
      </template>
    </PageHeader>
    <NAlert v-if="error" type="error" :title="t('policy.failed')" role="alert"
      >{{ error }}
      <p v-if="!loaded">{{ t('policy.loadFailed') }}</p></NAlert
    >
    <NAlert v-if="uncertain" type="warning">{{ t('policy.uncertain') }}</NAlert>
    <NSpin v-if="!loaded && busy" />
    <template v-if="loaded">
      <div class="policy-storage">
        <p>{{ t('policy.storageHint') }}</p>
        <label
          ><input v-model="database" type="checkbox" :disabled="busy" />
          {{ t('policy.database') }}</label
        >
      </div>
      <div class="policy-tabs" :aria-label="t('policy.title')">
        <button
          v-for="tab in ['overview', 'visual', 'source', 'review']"
          :key="tab"
          type="button"
          :class="{ active: view === tab }"
          :disabled="buffered"
          :aria-pressed="view === tab"
          @click="changeView(tab)"
        >
          {{ t(`policy.${tab}`) }}
        </button>
        <span class="policy-muted" role="status"
          >{{ dirty ? t('policy.dirty') : t('policy.clean') }} ·
          {{ validated ? t('policy.validated') : t('policy.notValidated') }}</span
        >
      </div>
      <NAlert v-if="buffered" type="warning">{{ t('policy.buffered') }}</NAlert>
      <NAlert v-if="parsed.error" type="error">{{ t('policy.syntax') }}: {{ parsed.error }}</NAlert>
      <div v-if="view === 'overview'" class="policy-overview">
        <h2>{{ t('policy.summary') }}</h2>
        <p>{{ t('policy.semanticHint') }}</p>
        <div class="policy-overview-grid">
          <button
            v-for="item in policySections"
            :key="item.id"
            class="policy-overview-card"
            @click="openSection(item.id)"
          >
            <strong>{{ t(`policy.sections.${item.id}`) }}</strong>
            <span v-for="key in item.fields" :key="key"
              ><code>{{ key }}</code
              >:
              {{
                parsed.value && Object.hasOwn(parsed.value, key)
                  ? JSON.stringify(parsed.value[key])
                  : t('policy.unset')
              }}</span
            >
          </button>
        </div>
        <p v-if="unknownKeys.length">{{ t('policy.unknown') }}: {{ unknownKeys.join(', ') }}</p>
      </div>
      <div v-if="!parsed.error && view === 'visual'" class="policy-workspace">
        <nav class="policy-sections" :aria-label="t('policy.summary')">
          <button
            v-for="item in policySections"
            :key="item.id"
            :class="{ active: section === item.id }"
            :disabled="buffered"
            :aria-pressed="section === item.id"
            @click="section = item.id"
          >
            {{ t(`policy.sections.${item.id}`) }}
          </button>
        </nav>
        <div class="policy-section-body">
          <h2>{{ t(`policy.sections.${section}`) }}</h2>
          <p class="policy-muted">{{ t(`policy.hints.${section}`) }}</p>
          <fieldset :disabled="busy">
            <PolicyField
              v-for="key in activeSection.fields"
              :key="`${formEpoch}:${key}`"
              :schema="policyFields[key]!"
              :structure-locked="buffered"
              :value="parsed.value?.[key]"
              :path="[key]"
              @edit="edit"
              @invalid="invalid"
            />
          </fieldset>
        </div>
      </div>
      <div v-if="view === 'source'" class="policy-source">
        <label for="policy-source">{{ t('policy.sourceLabel') }}</label>
        <p class="policy-muted">{{ t('policy.sourceHint') }}</p>
        <textarea
          id="policy-source"
          v-model="draft"
          :disabled="busy"
          spellcheck="false"
          rows="24"
        />
      </div>
      <div v-if="view === 'review'" class="policy-review">
        <p v-if="!dirty">{{ t('policy.noChanges') }}</p>
        <div class="policy-diff">
          <div>
            <h3>{{ t('policy.before') }}</h3>
            <pre>{{ baseline?.policy }}</pre>
          </div>
          <div>
            <h3>{{ t('policy.after') }}</h3>
            <pre>{{ draft }}</pre>
          </div>
        </div>
        <p class="policy-muted">{{ t('policy.raceWarning') }}</p>
        <NButton type="primary" :disabled="!canPublish" @click="confirm = true">{{
          t('policy.publish')
        }}</NButton>
      </div>
      <p class="policy-muted policy-footer">{{ t('policy.noAutoSave') }}</p>
    </template>
    <ConfirmDialog
      v-model:show="confirm"
      :title="t('policy.publish')"
      :message="t('policy.publishWarning')"
      :confirm-label="t('policy.confirmPublish')"
      :pending="busy"
      danger
      @confirm="publish"
    />
  </section>
</template>
