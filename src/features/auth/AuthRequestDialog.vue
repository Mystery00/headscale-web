<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NInput, NModal, NSpace } from 'naive-ui'
import { parseAuthId } from '@/domain/auth-id'
import AuthRequestPanel from '@/features/auth/AuthRequestPanel.vue'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()
const { t } = useI18n()
const input = ref('')
const authId = ref<string | null>(null)
const result = ref<string | null>(null)
const validInput = computed(() => parseAuthId(input.value))
const title = computed(() =>
  authId.value ? t('authRequests.registerTitle') : t('authRequests.manualTitle'),
)

watch(
  () => props.show,
  (visible) => {
    if (!visible) reset()
  },
)
function reset() {
  input.value = ''
  authId.value = null
  result.value = null
}
function close() {
  emit('update:show', false)
}
function continueToApproval() {
  authId.value = validInput.value
}
function complete(value: 'registered' | 'approved' | 'rejected') {
  result.value = value
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="title"
    :aria-label="t('authRequests.manualTitle')"
    :mask-closable="!authId"
    style="width: min(42rem, calc(100vw - 2rem))"
    @update:show="emit('update:show', $event)"
  >
    <div v-if="!authId" class="request-dialog">
      <p>{{ t('authRequests.manualDescription') }}</p>
      <NInput
        v-model:value="input"
        :placeholder="t('authRequests.manualPlaceholder')"
        :input-props="{
          'aria-label': t('authRequests.manualAuthId'),
          autocomplete: 'off',
          spellcheck: 'false',
        }"
      />
      <NSpace justify="end">
        <NButton @click="close">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" :disabled="!validInput" @click="continueToApproval">
          {{ t('authRequests.manualContinue') }}
        </NButton>
      </NSpace>
    </div>
    <AuthRequestPanel
      v-else
      mode="register"
      :auth-id="authId"
      :result="result"
      @complete="complete"
      @finish="close"
    />
  </NModal>
</template>

<style scoped>
.request-dialog {
  display: grid;
  gap: 1rem;
}
p {
  margin: 0;
  color: var(--admin-muted);
  line-height: 1.55;
}
</style>
