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
  it('syncs form updates to the text, preserves comments and unknown fields, and sends no writes', async () => {
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
  it('publishes only after validation, diff review, and explicit confirmation, then updates the baseline', async () => {
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
  it('locks visual editing and validation for invalid text but still allows export', async () => {
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
  it('applies list input to the draft immediately and keeps the line break being typed', async () => {
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
  it('keeps invalid app input when other fields are edited and blocks validation until it is fixed', async () => {
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
  it('blocks validation for duplicate properties in app to avoid silently dropping the earlier value', async () => {
    mockPolicy('{"grants":[{"app":{}}]}')
    await renderConnected('/policy', PolicyPage)
    await fireEvent.update(await screen.findByLabelText('grants.0.app'), '{"cap":[1],"cap":[2]}')
    expect(
      (screen.getByRole('button', { name: 'Validate policy' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
  it('blocks removing earlier rules while input is invalid to avoid mismatched indexes', async () => {
    mockPolicy('{"grants":[{"app":{}},{"app":{}}]}')
    await renderConnected('/policy', PolicyPage)
    await fireEvent.update(await screen.findByLabelText('grants.1.app'), '{')
    expect(
      (screen.getByRole('button', { name: 'Remove field grants.0' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
  it('resets the invalid input buffer after confirming a reload of the same server policy', async () => {
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
  it('does not crash the rule summary on unknown field types and keeps the source for text editing', async () => {
    mockPolicy('{"grants":[{"src":{"future":true},"dst":null}]}')
    await renderConnected('/policy', PolicyPage)
    expect(await screen.findAllByText(/unexpected type/)).toHaveLength(2)
    await fireEvent.click(screen.getByRole('button', { name: 'HuJSON editor' }))
    expect((screen.getByLabelText('Policy source') as HTMLTextAreaElement).value).toBe(
      '{"grants":[{"src":{"future":true},"dst":null}]}',
    )
  })
})
