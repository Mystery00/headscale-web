<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NModal, NSpace } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    show: boolean
    title: string
    message: string
    confirmLabel: string
    danger?: boolean
    pending?: boolean
  }>(),
  {
    danger: false,
    pending: false,
  },
)

const emit = defineEmits<{
  'update:show': [value: boolean]
  confirm: []
}>()

const { t } = useI18n()
const canConfirm = computed(() => !props.pending)

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
</style>
