import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import { http, HttpResponse } from 'msw'
import PreAuthKeysPage from '@/features/preauth-keys/PreAuthKeysPage.vue'
import { server } from '../msw/server'
import { renderConnected } from './render-connected'

describe('PreAuthKeysPage', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('shows a key preview instead of the full key', async () => {
    await renderConnected('/preauth-keys', PreAuthKeysPage)
    await waitFor(() => {
      expect(screen.getByText('hske…wxyz')).toBeTruthy()
    })
    expect(screen.getByRole('table', { name: 'PreAuth Keys' })).toBeTruthy()
    expect(screen.queryByText('hskey-abcdefghijklmnopqrstuvwxyz')).toBeNull()
  })

  it('disables creation and offers retry when users cannot be loaded', async () => {
    server.use(
      http.get('http://hs.example.com/api/v1/user', () =>
        HttpResponse.json({ message: 'failed' }, { status: 500 }),
      ),
    )
    await renderConnected('/preauth-keys', PreAuthKeysPage)
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('deletes all expired keys only after confirmation', async () => {
    const deletedIds: string[] = []
    server.use(
      http.get('http://hs.example.com/api/v1/preauthkey', () =>
        HttpResponse.json({
          preAuthKeys: [
            {
              id: 'expired-1',
              key: 'hskey-expired-one',
              used: false,
              createdAt: '2024-01-01T00:00:00Z',
              expiration: '2024-02-01T00:00:00Z',
            },
            {
              id: 'active-1',
              key: 'hskey-active-one',
              used: false,
              createdAt: '2024-01-01T00:00:00Z',
              expiration: '2099-02-01T00:00:00Z',
            },
            {
              id: 'expired-2',
              key: 'hskey-expired-two',
              used: false,
              createdAt: '2024-01-01T00:00:00Z',
              expiration: '2024-03-01T00:00:00Z',
            },
            {
              id: 'used-past',
              key: 'hskey-used-past',
              used: true,
              createdAt: '2024-01-01T00:00:00Z',
              expiration: '2024-01-15T00:00:00Z',
            },
          ],
        }),
      ),
      http.delete('http://hs.example.com/api/v1/preauthkey', ({ request }) => {
        deletedIds.push(new URL(request.url).searchParams.get('id') ?? '')
        return HttpResponse.json({})
      }),
    )

    await renderConnected('/preauth-keys', PreAuthKeysPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete expired (2)' }))

    expect(deletedIds).toEqual([])
    expect(screen.getByRole('dialog', { name: 'Delete expired PreAuth Keys' })).toBeTruthy()
    await fireEvent.click(screen.getByRole('button', { name: 'Delete expired' }))
    await waitFor(() => expect(deletedIds.sort()).toEqual(['expired-1', 'expired-2']))
    expect(deletedIds).not.toContain('active-1')
    expect(deletedIds).not.toContain('used-past')
  })

  it('deletes only the expired keys captured when confirmation opens', async () => {
    let includeLateKey = false
    const deletedIds: string[] = []
    server.use(
      http.get('http://hs.example.com/api/v1/preauthkey', () =>
        HttpResponse.json({
          preAuthKeys: [
            {
              id: 'expired-1',
              used: false,
              createdAt: '2024-01-01T00:00:00Z',
              expiration: '2024-02-01T00:00:00Z',
            },
            ...(includeLateKey
              ? [
                  {
                    id: 'expired-late',
                    used: false,
                    createdAt: '2024-01-01T00:00:00Z',
                    expiration: '2024-03-01T00:00:00Z',
                  },
                ]
              : []),
          ],
        }),
      ),
      http.delete('http://hs.example.com/api/v1/preauthkey', ({ request }) => {
        deletedIds.push(new URL(request.url).searchParams.get('id') ?? '')
        return HttpResponse.json({})
      }),
    )

    const view = await renderConnected('/preauth-keys', PreAuthKeysPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete expired (1)' }))
    includeLateKey = true
    await view.queryClient.invalidateQueries({ queryKey: ['preAuthKeys'] })
    await screen.findByRole('button', { name: 'Delete expired (2)' })

    await fireEvent.click(screen.getByRole('button', { name: 'Delete expired' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Delete expired PreAuth Keys' })).toBeNull(),
    )
    expect(deletedIds).toEqual(['expired-1'])
    expect(deletedIds).not.toContain('expired-late')
  })

  it('continues after a deletion failure and reports partial results', async () => {
    const attemptedIds: string[] = []
    server.use(
      http.get('http://hs.example.com/api/v1/preauthkey', () =>
        HttpResponse.json({
          preAuthKeys: ['expired-1', 'expired-2', 'expired-3'].map((id) => ({
            id,
            used: false,
            createdAt: '2024-01-01T00:00:00Z',
            expiration: '2024-02-01T00:00:00Z',
          })),
        }),
      ),
      http.delete('http://hs.example.com/api/v1/preauthkey', ({ request }) => {
        const id = new URL(request.url).searchParams.get('id') ?? ''
        attemptedIds.push(id)
        return id === 'expired-2'
          ? HttpResponse.json({ message: 'failed' }, { status: 500 })
          : HttpResponse.json({})
      }),
    )

    await renderConnected('/preauth-keys', PreAuthKeysPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete expired (3)' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Delete expired' }))

    await waitFor(() => expect(attemptedIds).toEqual(['expired-1', 'expired-2', 'expired-3']))
    expect(await screen.findByText('Deleted 2 expired keys; 1 failed.')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Delete expired PreAuth Keys' })).toBeTruthy()
  })

  it('deletes all used keys without including active or expired keys', async () => {
    const deletedIds: string[] = []
    server.use(
      http.get('http://hs.example.com/api/v1/preauthkey', () =>
        HttpResponse.json({
          preAuthKeys: [
            {
              id: 'used-future',
              used: true,
              createdAt: '2024-01-01T00:00:00Z',
              expiration: '2099-02-01T00:00:00Z',
            },
            {
              id: 'used-past',
              used: true,
              createdAt: '2024-01-01T00:00:00Z',
              expiration: '2024-02-01T00:00:00Z',
            },
            {
              id: 'expired-unused',
              used: false,
              createdAt: '2024-01-01T00:00:00Z',
              expiration: '2024-02-01T00:00:00Z',
            },
            {
              id: 'active-unused',
              used: false,
              createdAt: '2024-01-01T00:00:00Z',
              expiration: '2099-02-01T00:00:00Z',
            },
          ],
        }),
      ),
      http.delete('http://hs.example.com/api/v1/preauthkey', ({ request }) => {
        deletedIds.push(new URL(request.url).searchParams.get('id') ?? '')
        return HttpResponse.json({})
      }),
    )

    await renderConnected('/preauth-keys', PreAuthKeysPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete used (2)' }))
    expect(deletedIds).toEqual([])
    expect(screen.getByRole('dialog', { name: 'Delete used PreAuth Keys' })).toBeTruthy()
    await fireEvent.click(screen.getByRole('button', { name: 'Delete used' }))
    await waitFor(() => expect(deletedIds.sort()).toEqual(['used-future', 'used-past']))
    expect(deletedIds).not.toContain('expired-unused')
    expect(deletedIds).not.toContain('active-unused')
  })

  it('asks for confirmation before deleting a key', async () => {
    await renderConnected('/preauth-keys', PreAuthKeysPage)
    await fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Delete PreAuth Key' })).toBeTruthy()
  })
})
