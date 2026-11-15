import { describe, expect, it, vi } from 'vitest'
import { createPolicyWorkbench } from '@/features/policy/policy-workbench'
import type { PolicyRepository } from '@/repositories/policy-repository'

function setup() {
  let remote = '{}'
  const repo: PolicyRepository = {
    get: vi.fn(async () => ({ policy: remote })),
    check: vi.fn(async () => {}),
    set: vi.fn(async (text) => {
      remote = text
    }),
  }
  return {
    repo,
    state: createPolicyWorkbench(repo),
    changeRemote: (text: string) => {
      remote = text
    },
  }
}
describe('policy draft and publish protection', () => {
  it('does not allow validation or saving after a load failure', async () => {
    const { repo, state } = setup()
    vi.mocked(repo.get).mockRejectedValue(new Error('offline'))
    await expect(state.load()).rejects.toThrow('offline')
    expect(state.loaded.value).toBe(false)
    await expect(state.check()).rejects.toThrow()
    await expect(state.save()).rejects.toThrow()
    expect(repo.set).not.toHaveBeenCalled()
  })
  it('does not mark a new draft as validated from a stale validation response', async () => {
    const { repo, state } = setup()
    await state.load()
    let resolve!: () => void
    vi.mocked(repo.check).mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done
        }),
    )
    state.draft.value = '{"tagOwners":{}}'
    const pending = state.check()
    state.draft.value = '{"grants":[]}'
    resolve()
    await pending
    expect(state.validated.value).toBe(false)
    await expect(state.save()).rejects.toThrow()
    expect(repo.set).not.toHaveBeenCalled()
  })
  it('aborts the write and keeps the local draft on conflict', async () => {
    const { repo, state, changeRemote } = setup()
    await state.load()
    state.draft.value = '{"grants":[]}'
    await state.check()
    changeRemote('{"randomizeClientPort":true}')
    await expect(state.save()).rejects.toThrow('PolicyConflict')
    expect(repo.set).not.toHaveBeenCalled()
    expect(state.draft.value).toBe('{"grants":[]}')
  })
  it('reads the server text and updates the baseline after a successful save', async () => {
    const { state } = setup()
    await state.load()
    state.draft.value = '{"tagOwners":{"tag:lab":[]}}'
    await state.check()
    await state.save()
    expect(state.dirty.value).toBe(false)
    expect(state.baseline.value?.policy).toBe('{"tagOwners":{"tag:lab":[]}}')
  })
  it('keeps the draft and invalidates validation when saving is rejected, without retrying automatically', async () => {
    const { repo, state } = setup()
    await state.load()
    state.draft.value = '{"grants":[]}'
    await state.check()
    vi.mocked(repo.set).mockRejectedValue(new Error('file mode'))
    await expect(state.save()).rejects.toThrow('file mode')
    expect(repo.set).toHaveBeenCalledTimes(1)
    expect(state.dirty.value).toBe(true)
    expect(state.validated.value).toBe(false)
  })
  it('aborts the write when the draft changes during the pre-publish read', async () => {
    const { repo, state } = setup()
    await state.load()
    state.draft.value = '{"grants":[]}'
    await state.check()
    vi.mocked(repo.get).mockImplementationOnce(async () => {
      state.draft.value = '{}'
      return { policy: '{}' }
    })
    await expect(state.save()).rejects.toThrow('PolicyDraftChanged')
    expect(repo.set).not.toHaveBeenCalled()
  })
})
