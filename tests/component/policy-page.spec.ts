import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import { http, HttpResponse } from 'msw'
import PolicyPage from '@/features/policy/PolicyPage.vue'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

describe('PolicyPage', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => {
    server.resetHandlers()
    vi.restoreAllMocks()
  })
  afterAll(() => server.close())
  function mockPolicy(policy = '{/* preserved */"tagOwners":{"tag:lab":[]},"future":42}') {
    let remote = policy
    const writes: string[] = []
    server.use(
      http.get('http://hs.example.com/api/v1/policy', () => HttpResponse.json({ policy: remote })),
      http.post('http://hs.example.com/api/v1/policy/check', () => HttpResponse.json({})),
      http.put('http://hs.example.com/api/v1/policy', async ({ request }) => {
        const body = (await request.json()) as { policy: string }
        remote = body.policy
        writes.push(remote)
        return HttpResponse.json({ policy: remote })
      }),
    )
    return writes
  }
  it('表单更新同步文本并保留注释和未知字段，不发送写入', async () => {
    const writes = mockPolicy()
    await renderConnected('/policy', PolicyPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Tag owners' }))
    const owners = await screen.findByLabelText('tagOwners.tag:lab')
    await fireEvent.change(owners, { target: { value: 'group:ops' } })
    await fireEvent.click(screen.getByRole('button', { name: 'HuJSON editor' }))
    const editor = screen.getByLabelText('Policy source') as HTMLTextAreaElement
    expect(editor.value).toContain('/* preserved */')
    expect(editor.value).toContain('group:ops')
    expect(editor.value).toContain('"future":42')
    expect(writes).toEqual([])
  })
  it('校验、差异、明确确认后才发布，成功更新基线', async () => {
    const writes = mockPolicy('{}')
    await renderConnected('/policy', PolicyPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'HuJSON editor' }))
    await fireEvent.update(screen.getByLabelText('Policy source'), '{"randomizeClientPort":true}')
    await fireEvent.click(screen.getByLabelText('The server already uses database policy storage'))
    await fireEvent.click(screen.getByRole('button', { name: 'Validate policy' }))
    await screen.findByText(/Validation passed for this draft/)
    await fireEvent.click(screen.getAllByRole('button', { name: 'Review changes' })[0]!)
    await fireEvent.click(screen.getByRole('button', { name: 'Publish policy' }))
    expect(writes).toEqual([])
    await fireEvent.click(screen.getByRole('button', { name: 'Confirm publish' }))
    await waitFor(() => expect(writes).toEqual(['{"randomizeClientPort":true}']))
    await screen.findByText(/Draft matches server/)
  })
  it('无效文本锁定可视化编辑与校验，但仍可导出', async () => {
    mockPolicy('{}')
    await renderConnected('/policy', PolicyPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'HuJSON editor' }))
    await fireEvent.update(screen.getByLabelText('Policy source'), '{broken')
    expect(
      (screen.getByRole('button', { name: 'Validate policy' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Export draft' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    await fireEvent.click(screen.getByRole('button', { name: 'Visual configuration' }))
    expect(screen.queryByRole('button', { name: 'Tag owners' })).toBeNull()
  })
  it('列表输入即时进入草稿且保留正在输入的换行', async () => {
    mockPolicy()
    await renderConnected('/policy', PolicyPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Tag owners' }))
    const owners = screen.getByLabelText('tagOwners.tag:lab') as HTMLTextAreaElement
    await fireEvent.input(owners, { target: { value: 'group:ops\n' } })
    expect(owners.value).toBe('group:ops\n')
    expect(screen.getByRole('status').textContent).toContain('Draft has changes')
    await fireEvent.click(screen.getByRole('button', { name: 'HuJSON editor' }))
    expect((screen.getByLabelText('Policy source') as HTMLTextAreaElement).value).toContain(
      'group:ops',
    )
  })
  it('无效 app 输入不会被其他字段编辑覆盖，修正前不允许校验', async () => {
    mockPolicy('{"grants":[{"src":["*"],"dst":["*"],"app":{}}]}')
    await renderConnected('/policy', PolicyPage)
    const app = (await screen.findByLabelText('grants.0.app')) as HTMLTextAreaElement
    await fireEvent.input(app, { target: { value: '{"cap":' } })
    await fireEvent.change(screen.getByLabelText('grants.0.src'), {
      target: { value: 'group:ops' },
    })
    expect(app.value).toBe('{"cap":')
    expect(
      (screen.getByRole('button', { name: 'Validate policy' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    await fireEvent.input(app, { target: { value: '{"cap":[]}' } })
    expect(
      (screen.getByRole('button', { name: 'Validate policy' }) as HTMLButtonElement).disabled,
    ).toBe(false)
  })
  it('app 中重复属性也禁止校验，避免静默丢弃前值', async () => {
    mockPolicy('{"grants":[{"app":{}}]}')
    await renderConnected('/policy', PolicyPage)
    await fireEvent.update(await screen.findByLabelText('grants.0.app'), '{"cap":[1],"cap":[2]}')
    expect(
      (screen.getByRole('button', { name: 'Validate policy' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
  it('无效输入期间阻止删除前序规则以免错配索引', async () => {
    mockPolicy('{"grants":[{"app":{}},{"app":{}}]}')
    await renderConnected('/policy', PolicyPage)
    await fireEvent.update(await screen.findByLabelText('grants.1.app'), '{')
    expect(
      (screen.getByRole('button', { name: 'Remove field grants.0' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
  it('确认重新读取相同服务器策略后重置无效输入缓冲', async () => {
    mockPolicy('{"grants":[{"app":{}}]}')
    await renderConnected('/policy', PolicyPage)
    await fireEvent.update(await screen.findByLabelText('grants.0.app'), '{"cap":')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await fireEvent.click(screen.getByRole('button', { name: 'Reload from server' }))
    await waitFor(() =>
      expect((screen.getByLabelText('grants.0.app') as HTMLTextAreaElement).value).toBe('{}'),
    )
    expect(
      (screen.getByRole('button', { name: 'Validate policy' }) as HTMLButtonElement).disabled,
    ).toBe(false)
  })
  it('未知字段类型不会让规则摘要崩溃，保留原文供文本编辑', async () => {
    mockPolicy('{"grants":[{"src":{"future":true},"dst":null}]}')
    await renderConnected('/policy', PolicyPage)
    expect(await screen.findAllByText(/unexpected type/)).toHaveLength(2)
    await fireEvent.click(screen.getByRole('button', { name: 'HuJSON editor' }))
    expect((screen.getByLabelText('Policy source') as HTMLTextAreaElement).value).toBe(
      '{"grants":[{"src":{"future":true},"dst":null}]}',
    )
  })
})
