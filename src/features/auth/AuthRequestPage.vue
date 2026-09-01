<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { NAlert, NButton, NCard, NSelect, NSpace } from 'naive-ui'
import { AppApiError } from '@/api/errors'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { maskAuthId, parseAuthId } from '@/domain/auth-id'
import type { Node } from '@/domain/node'
import { useUsersQuery } from '@/query/use-headscale-queries'
import {
  useApproveAuthMutation,
  useRegisterAuthMutation,
  useRejectAuthMutation,
} from '@/query/use-headscale-mutations'

const props = defineProps<{ mode: 'register' | 'reauth' }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const isRegister = computed(() => props.mode === 'register')
const users = useUsersQuery()
const register = useRegisterAuthMutation()
const approve = useApproveAuthMutation()
const reject = useRejectAuthMutation()
const selectedUserName = ref<string | null>(null)
const registeredNode = ref<Node | null>(null)
const confirmPrimary = ref(false)
const confirmReject = ref(false)
const errorMessage = ref<string | null>(null)

const authId = computed(() => parseAuthId(route.query.authId))
const result = computed(() => (typeof route.query.result === 'string' ? route.query.result : null))
const pending = computed(
  () => register.isPending.value || approve.isPending.value || reject.isPending.value,
)
const userOptions = computed(() =>
  (users.data.value ?? []).map((user) => ({ label: user.name, value: user.name })),
)
const title = computed(() =>
  t(isRegister.value ? 'authRequests.registerTitle' : 'authRequests.reauthTitle'),
)

function mapError(error: unknown): string {
  if (!(error instanceof AppApiError)) return t('authRequests.errors.unknown')
  if (error.kind === 'not-found' || error.kind === 'conflict') return t('authRequests.errors.stale')
  if (error.kind === 'validation') return t('authRequests.errors.invalid')
  if (error.kind === 'unauthorized' || error.kind === 'forbidden')
    return t('authRequests.errors.unauthorized')
  if (error.kind === 'timeout') return t('authRequests.errors.timeout')
  if (error.kind === 'network' || error.kind === 'cors') return t('authRequests.errors.network')
  return t('authRequests.errors.unknown')
}

async function finish(resultValue: 'registered' | 'approved' | 'rejected') {
  await router.replace({ path: route.path, query: { result: resultValue } })
}

async function runPrimary() {
  if (!authId.value) return
  errorMessage.value = null
  try {
    if (isRegister.value) {
      if (!selectedUserName.value) return
      registeredNode.value = await register.mutateAsync({
        authId: authId.value,
        userName: selectedUserName.value,
      })
      await finish('registered')
    } else {
      await approve.mutateAsync(authId.value)
      await finish('approved')
    }
    confirmPrimary.value = false
  } catch (error) {
    errorMessage.value = mapError(error)
    confirmPrimary.value = false
  }
}

async function runReject() {
  if (!authId.value) return
  errorMessage.value = null
  try {
    await reject.mutateAsync(authId.value)
    await finish('rejected')
    confirmReject.value = false
  } catch (error) {
    errorMessage.value = mapError(error)
    confirmReject.value = false
  }
}
</script>

<template>
  <main class="auth-request-page">
    <NCard class="auth-card" :title="title">
      <template v-if="result">
        <NAlert type="success" :bordered="false">
          {{ t(`authRequests.results.${result}`) }}
        </NAlert>
        <dl v-if="registeredNode" class="node-summary">
          <div>
            <dt>{{ t('nodes.name') }}</dt>
            <dd>{{ registeredNode.givenName || registeredNode.name }}</dd>
          </div>
          <div>
            <dt>{{ t('nodes.user') }}</dt>
            <dd>{{ registeredNode.user.name }}</dd>
          </div>
          <div>
            <dt>{{ t('nodes.ip') }}</dt>
            <dd>{{ registeredNode.ipAddresses.join(', ') || t('common.unavailable') }}</dd>
          </div>
        </dl>
        <NSpace>
          <NButton v-if="result === 'registered'" type="primary" @click="router.push('/nodes')">
            {{ t('authRequests.viewNodes') }}
          </NButton>
          <NButton v-else @click="router.push('/')">{{ t('authRequests.returnHome') }}</NButton>
        </NSpace>
      </template>

      <template v-else-if="!authId">
        <NAlert type="error" :bordered="false">{{ t('authRequests.errors.invalid') }}</NAlert>
      </template>

      <div v-else class="request-stack">
        <p>
          {{
            t(isRegister ? 'authRequests.registerDescription' : 'authRequests.reauthDescription')
          }}
        </p>
        <NAlert type="warning" :bordered="false">{{ t('authRequests.safetyWarning') }}</NAlert>
        <div class="auth-id">
          <span>{{ t('authRequests.requestId') }}</span>
          <code>{{ maskAuthId(authId) }}</code>
        </div>
        <NSelect
          v-if="isRegister"
          v-model:value="selectedUserName"
          :options="userOptions"
          :loading="users.isLoading.value"
          :placeholder="t('authRequests.targetUser')"
          :aria-label="t('authRequests.targetUser')"
        />
        <NAlert v-if="errorMessage" type="error" :bordered="false">{{ errorMessage }}</NAlert>
        <NSpace justify="end">
          <NButton type="error" secondary :disabled="pending" @click="confirmReject = true">
            {{ t('authRequests.reject') }}
          </NButton>
          <NButton
            type="primary"
            :disabled="pending || (isRegister && !selectedUserName)"
            @click="confirmPrimary = true"
          >
            {{ t(isRegister ? 'authRequests.register' : 'authRequests.approve') }}
          </NButton>
        </NSpace>
      </div>
    </NCard>

    <ConfirmDialog
      v-model:show="confirmPrimary"
      :title="
        t(isRegister ? 'authRequests.confirmRegisterTitle' : 'authRequests.confirmApproveTitle')
      "
      :message="
        t(
          isRegister ? 'authRequests.confirmRegisterMessage' : 'authRequests.confirmApproveMessage',
          { user: selectedUserName || '' },
        )
      "
      :confirm-label="
        t(isRegister ? 'authRequests.confirmRegister' : 'authRequests.confirmApprove')
      "
      :pending="pending"
      @confirm="runPrimary"
    />
    <ConfirmDialog
      v-model:show="confirmReject"
      :title="t('authRequests.confirmRejectTitle')"
      :message="t('authRequests.confirmRejectMessage')"
      :confirm-label="t('authRequests.confirmReject')"
      danger
      :pending="pending"
      @confirm="runReject"
    />
  </main>
</template>

<style scoped>
.auth-request-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: var(--admin-bg);
  color: var(--admin-text);
}
.auth-card {
  width: min(42rem, 100%);
}
.request-stack,
.node-summary {
  display: grid;
  gap: 1rem;
}
p {
  margin: 0;
  color: var(--admin-muted);
  line-height: 1.6;
}
.auth-id {
  display: grid;
  gap: 0.4rem;
  padding: 1rem;
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
  background: var(--admin-surface-muted);
}
.auth-id span,
dt {
  color: var(--admin-muted);
  font-size: 0.8rem;
}
.auth-id code {
  overflow-wrap: anywhere;
}
.node-summary {
  margin: 1rem 0;
}
.node-summary div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
}
</style>
