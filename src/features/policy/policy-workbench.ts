import { computed, ref, shallowRef, watch } from 'vue'
import { parsePolicy } from '@/domain/policy-document'
import type { PolicyRepository, PolicySnapshot } from '@/repositories/policy-repository'

export function createPolicyWorkbench(repo: PolicyRepository) {
  const baseline = shallowRef<PolicySnapshot>()
  const draft = ref('')
  const busy = ref(false)
  const checkedRevision = ref<number>()
  const revision = ref(0)
  const uncertain = ref(false)
  watch(
    draft,
    () => {
      revision.value++
      checkedRevision.value = undefined
    },
    { flush: 'sync' },
  )
  const loaded = computed(() => baseline.value !== undefined)
  const dirty = computed(() => loaded.value && draft.value !== baseline.value?.policy)
  const parsed = computed(() => parsePolicy(draft.value))
  const validated = computed(() => checkedRevision.value === revision.value && !parsed.value.error)
  async function load() {
    if (busy.value) return
    busy.value = true
    try {
      const snapshot = await repo.get()
      baseline.value = snapshot
      draft.value = snapshot.policy
      checkedRevision.value = undefined
      uncertain.value = false
    } finally {
      busy.value = false
    }
  }
  function requireDraft() {
    if (!loaded.value || parsed.value.error || busy.value || uncertain.value)
      throw new Error('PolicyNotReady')
  }
  async function check() {
    requireDraft()
    const captured = revision.value
    checkedRevision.value = undefined
    busy.value = true
    try {
      await repo.check(draft.value)
      if (captured === revision.value) checkedRevision.value = captured
    } finally {
      busy.value = false
    }
  }
  async function save() {
    requireDraft()
    if (!validated.value || !dirty.value) throw new Error('PolicyNotReady')
    const captured = revision.value
    const text = draft.value
    busy.value = true
    try {
      const current = await repo.get()
      if (
        current.policy !== baseline.value?.policy ||
        current.updatedAt !== baseline.value?.updatedAt
      )
        throw new Error('PolicyConflict')
      if (revision.value !== captured) throw new Error('PolicyDraftChanged')
      // PUT 可能已在服务器生效但响应丢失；需要重新读取才能再次发布。
      uncertain.value = true
      await repo.set(text)
      const saved = await repo.get()
      baseline.value = saved
      if (revision.value === captured) draft.value = saved.policy
      uncertain.value = false
    } finally {
      checkedRevision.value = undefined
      busy.value = false
    }
  }
  return { baseline, draft, busy, loaded, dirty, parsed, validated, uncertain, load, check, save }
}
