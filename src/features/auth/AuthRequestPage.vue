<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { NCard } from 'naive-ui'
import { parseAuthId } from '@/domain/auth-id'
import AuthRequestPanel from '@/features/auth/AuthRequestPanel.vue'

const props = defineProps<{ mode: 'register' | 'reauth' }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authId = computed(() => parseAuthId(route.query.authId))
const result = computed(() => (typeof route.query.result === 'string' ? route.query.result : null))
const title = computed(() =>
  t(props.mode === 'register' ? 'authRequests.registerTitle' : 'authRequests.reauthTitle'),
)

async function complete(value: 'registered' | 'approved' | 'rejected') {
  await router.replace({ path: route.path, query: { result: value } })
}
function finish() {
  void router.push(result.value === 'registered' ? '/nodes' : '/')
}
</script>

<template>
  <main class="auth-request-page">
    <NCard class="auth-card" :title="title">
      <AuthRequestPanel
        :mode="mode"
        :auth-id="authId"
        :result="result"
        @complete="complete"
        @finish="finish"
      />
    </NCard>
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
</style>
