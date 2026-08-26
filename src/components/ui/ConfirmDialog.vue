<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NInput, NModal, NSpace } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    show: boolean
    title: string
    message: string
    confirmLabel: string
    confirmText?: string
    expectedText?: string
    danger?: boolean
    pending?: boolean
  }>(),
  {
    confirmText: undefined,
    expectedText: undefined,
    danger: false,
    pending: false,
  },
)

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: []
}>()

const { t } = useI18n()
const typedValue = ref('')

const requiresTypedMatch = computed(() => Boolean(props.expectedText))
const canConfirm = computed(() => {
  if (props.pending) return false
  if (!requiresTypedMatch.value) return true
  return typedValue.value === props.expectedText
})

watch(
  () => props.show,
  (visible) => {
    if (!visible) typedValue.value = ''
  },
)

function close() {
  emit('update:show', false)
}

function confirm() {
  if (!canConfirm.value) return
  emit('confirm')
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="title"
    :mask-closable="!pending"
    :closable="!pending"
    :aria-label="title"
    style="width: min(28rem, calc(100vw - 2rem))"
    @update:show="emit('update:show', $event)"
  >
    <div class="confirm-dialog">
      <p>{{ message }}</p>
      <label v-if="requiresTypedMatch" class="confirm-dialog__typed">
        <span>{{ confirmText }}</span>
        <NInput
          v-model:value="typedValue"
          :placeholder="expectedText"
          :input-props="{ 'aria-label': confirmText || title, autocomplete: 'off' }"
          :disabled="pending"
        />
      </label>
      <NSpace justify="end">
        <NButton :disabled="pending" @click="close">{{ t('common.cancel') }}</NButton>
        <NButton
          :type="danger ? 'error' : 'primary'"
          :disabled="!canConfirm"
          :loading="pending"
          @click="confirm"
        >
          {{ confirmLabel }}
        </NButton>
      </NSpace>
    </div>
  </NModal>
</template>

<style scoped>
.confirm-dialog {
  display: grid;
  gap: 1rem;
}

p {
  margin: 0;
  color: var(--admin-muted);
  font-size: 0.9rem;
  line-height: 1.55;
}

.confirm-dialog__typed {
  display: grid;
  gap: 0.45rem;
  color: var(--admin-text);
  font-size: 0.82rem;
  font-weight: 600;
}
</style>
