<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isObject, parsePolicy, type PolicyPath } from '@/domain/policy-document'
import { fieldDefault, type PolicyFieldSchema } from './policy-fields'

const props = defineProps<{
  schema: PolicyFieldSchema
  value: unknown
  path: PolicyPath
  structureLocked?: boolean
  hideHeading?: boolean
}>()
const emit = defineEmits<{
  edit: [path: PolicyPath, value: unknown]
  invalid: [path: string, invalid: boolean]
}>()
const { t } = useI18n()
const id = useId()
const keyName = ref('')
const localError = ref('')
const jsonText = ref('')
const listText = ref('')
let emittedValue: string | undefined
const label = computed(() => props.path.join('.'))
watch(
  () => JSON.stringify(props.value),
  (serialized) => {
    if (serialized === emittedValue) return
    jsonText.value = JSON.stringify(props.value, null, 2) ?? ''
    listText.value =
      props.schema.kind === 'list' &&
      Array.isArray(props.value) &&
      props.value.every((item) => typeof item === 'string')
        ? props.value.join('\n')
        : ''
  },
  { immediate: true },
)
const compatible = computed(() => {
  const v = props.value
  if (v === undefined) return true
  switch (props.schema.kind) {
    case 'string':
      return typeof v === 'string'
    case 'list':
      return Array.isArray(v) && v.every((item) => typeof item === 'string')
    case 'boolean':
      return typeof v === 'boolean'
    case 'array':
      return Array.isArray(v)
    default:
      return isObject(v)
  }
})
const entries = computed(() => (isObject(props.value) ? Object.entries(props.value) : []))
const items = computed(() => (Array.isArray(props.value) ? props.value : []))
const unknownKeys = computed(() =>
  entries.value
    .filter(([key]) => !Object.hasOwn(props.schema.fields ?? {}, key))
    .map(([key]) => key),
)
function update(value: unknown) {
  if (JSON.stringify(value) === JSON.stringify(props.value)) return
  emit('edit', props.path, value)
}
function updateList(event: Event) {
  listText.value = (event.target as HTMLTextAreaElement).value
  const value = listText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  emittedValue = JSON.stringify(value)
  update(value)
}
function addKey() {
  if (props.structureLocked) return
  const key = keyName.value.trim()
  if (!key || (isObject(props.value) && Object.hasOwn(props.value, key))) {
    localError.value = t('policy.duplicateKey')
    return
  }
  localError.value = ''
  emit('edit', [...props.path, key], fieldDefault(props.schema.item!))
  keyName.value = ''
}
function updateJson(event: Event) {
  jsonText.value = (event.target as HTMLTextAreaElement).value
  try {
    const parsed = parsePolicy(jsonText.value)
    if (parsed.error || !parsed.value) throw new Error('InvalidObject')
    const value = parsed.value
    emittedValue = JSON.stringify(value)
    localError.value = ''
    emit('invalid', label.value, false)
    update(value)
  } catch {
    localError.value = t('policy.jsonInvalid')
    emit('invalid', label.value, true)
  }
}
function remove() {
  if (props.structureLocked) return
  emit('invalid', label.value, false)
  localError.value = ''
  update(undefined)
}
function removeItem(index: number) {
  if (props.structureLocked) return
  const itemPath = [...props.path, index]
  emit('invalid', itemPath.join('.'), false)
  emit('edit', itemPath, undefined)
}
function ruleSummary(item: unknown): string {
  if (!isObject(item)) return ''
  return [item.src, item.dst, item.target]
    .filter((value) => value !== undefined)
    .flat()
    .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
    .join(' → ')
}
</script>

<template>
  <div
    class="policy-field"
    :class="[`policy-field--${schema.kind}`, { 'policy-field--headless': hideHeading }]"
  >
    <div v-if="!hideHeading" class="policy-field__heading">
      <label :for="id"
        ><code>{{ path.at(-1) }}</code></label
      >
      <span v-if="value === undefined" class="policy-muted">{{ t('policy.unset') }}</span>
      <button
        v-else
        type="button"
        class="policy-link"
        :aria-label="`${t('policy.unsetField')} ${label}`"
        :disabled="structureLocked"
        @click="remove"
      >
        {{ t('policy.unsetField') }}
      </button>
    </div>
    <div v-if="!compatible" class="policy-notice">
      {{ t('policy.unsupportedShape') }}
      <pre>{{ JSON.stringify(value, null, 2) }}</pre>
    </div>
    <template v-else-if="schema.kind === 'string'">
      <select
        v-if="schema.options"
        :id="id"
        :aria-label="label"
        :value="value ?? ''"
        @change="update(($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>{{ t('policy.unset') }}</option>
        <option
          v-if="typeof value === 'string' && value && !schema.options.includes(value)"
          :value="value"
        >
          {{ value }}
        </option>
        <option v-for="option in schema.options" :key="option" :value="option">{{ option }}</option>
      </select>
      <input
        v-else
        :id="id"
        :aria-label="label"
        :value="value ?? ''"
        :placeholder="schema.placeholder"
        @input="update(($event.target as HTMLInputElement).value)"
      />
    </template>
    <template v-else-if="schema.kind === 'boolean'">
      <select
        :id="id"
        :aria-label="label"
        :value="value === undefined ? 'unset' : String(value)"
        @change="
          update(
            ($event.target as HTMLSelectElement).value === 'unset'
              ? undefined
              : ($event.target as HTMLSelectElement).value === 'true',
          )
        "
      >
        <option value="unset">{{ t('policy.unset') }}</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </template>
    <template v-else-if="schema.kind === 'list'">
      <textarea
        :id="id"
        :aria-label="label"
        :value="listText"
        rows="3"
        :placeholder="schema.placeholder"
        @input="updateList"
        @change="updateList"
      />
      <small class="policy-muted">{{ t('policy.listHint') }}</small>
      <button v-if="value === undefined" type="button" class="policy-link" @click="update([])">
        {{ t('policy.setEmpty') }}
      </button>
    </template>
    <template v-else-if="value === undefined">
      <button type="button" class="policy-button" @click="update(fieldDefault(schema))">
        {{ t('policy.define') }} {{ path.at(-1) }}
      </button>
    </template>
    <template v-else-if="schema.kind === 'json'">
      <textarea
        :id="id"
        :aria-label="label"
        :value="jsonText"
        rows="8"
        spellcheck="false"
        @input="updateJson"
      />
      <small class="policy-muted">{{ t('policy.appHint') }}</small>
    </template>
    <template v-else-if="schema.kind === 'object'">
      <div class="policy-field-grid">
        <PolicyField
          v-for="(child, key) in schema.fields"
          :key="key"
          :schema="child"
          :structure-locked="structureLocked"
          :value="isObject(value) ? value[key] : undefined"
          :path="[...path, key]"
          @edit="(p, v) => emit('edit', p, v)"
          @invalid="(p, v) => emit('invalid', p, v)"
        />
      </div>
      <p v-if="unknownKeys.length" class="policy-muted">
        {{ t('policy.unknown') }}: {{ unknownKeys.join(', ') }}
      </p>
    </template>
    <template v-else-if="schema.kind === 'map'">
      <p v-if="!entries.length" class="policy-muted">{{ t('policy.emptyObject') }}</p>
      <PolicyField
        v-for="[key, entry] in entries"
        :key="key"
        :schema="schema.item!"
        :structure-locked="structureLocked"
        :value="entry"
        :path="[...path, key]"
        @edit="(p, v) => emit('edit', p, v)"
        @invalid="(p, v) => emit('invalid', p, v)"
      />
      <div class="policy-add-key">
        <input
          v-model="keyName"
          :aria-label="`${t('policy.newKey')} ${label}`"
          :placeholder="schema.placeholder"
          @keydown.enter.prevent="addKey"
        />
        <button type="button" class="policy-button" :disabled="structureLocked" @click="addKey">
          {{ t('policy.add') }}
        </button>
      </div>
    </template>
    <template v-else-if="schema.kind === 'array'">
      <p v-if="!items.length" class="policy-notice">{{ t('policy.emptyArray') }}</p>
      <details v-for="(item, index) in items" :key="index" class="policy-rule" open>
        <summary class="policy-rule__summary">
          <span class="policy-rule__title">
            <strong>{{ t('policy.rule') }} {{ index + 1 }}</strong>
            <code v-if="ruleSummary(item)">{{ ruleSummary(item) }}</code>
          </span>
          <button
            type="button"
            class="policy-link"
            :aria-label="`${t('policy.unsetField')} ${[...path, index].join('.')}`"
            :disabled="structureLocked"
            @click.stop="removeItem(index)"
          >
            {{ t('policy.unsetField') }}
          </button>
        </summary>
        <PolicyField
          :schema="schema.item!"
          :structure-locked="structureLocked"
          :hide-heading="true"
          :value="item"
          :path="[...path, index]"
          @edit="(p, v) => emit('edit', p, v)"
          @invalid="(p, v) => emit('invalid', p, v)"
        />
      </details>
      <button
        type="button"
        class="policy-button"
        :disabled="structureLocked"
        @click="emit('edit', [...path, items.length], fieldDefault(schema.item!))"
      >
        ＋ {{ t('policy.addRule') }}
      </button>
    </template>
    <p v-if="localError" role="alert" class="policy-error">{{ localError }}</p>
  </div>
</template>
