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
describe('策略草稿与发布保护', () => {
  it('加载失败不允许校验或保存', async () => {
    const { repo, state } = setup()
    vi.mocked(repo.get).mockRejectedValue(new Error('offline'))
    await expect(state.load()).rejects.toThrow('offline')
    expect(state.loaded.value).toBe(false)
    await expect(state.check()).rejects.toThrow()
    await expect(state.save()).rejects.toThrow()
    expect(repo.set).not.toHaveBeenCalled()
  })
  it('校验中的旧响应不能使新草稿成为已校验状态', async () => {
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
  it('冲突中止写入并保留本地草稿', async () => {
    const { repo, state, changeRemote } = setup()
    await state.load()
    state.draft.value = '{"grants":[]}'
    await state.check()
    changeRemote('{"randomizeClientPort":true}')
    await expect(state.save()).rejects.toThrow('PolicyConflict')
    expect(repo.set).not.toHaveBeenCalled()
    expect(state.draft.value).toBe('{"grants":[]}')
  })
  it('保存成功读取服务器原文并更新基线', async () => {
    const { state } = setup()
    await state.load()
    state.draft.value = '{"tagOwners":{"tag:lab":[]}}'
    await state.check()
    await state.save()
    expect(state.dirty.value).toBe(false)
    expect(state.baseline.value?.policy).toBe('{"tagOwners":{"tag:lab":[]}}')
  })
  it('保存被拒绝时保留草稿且失效校验；不自动重试', async () => {
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
  it('发布前读取期间草稿变化时中止写入', async () => {
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
