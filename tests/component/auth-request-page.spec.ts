import { http, HttpResponse } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import { renderConnected } from './render-connected'
import { server } from '../msw/server'

const BASE_URL = 'http://hs.example.com'
const authId = 'hskey-authreq-abcdefghijklmnopqrstuvwx'

describe('AuthRequestPage', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('rejects a malformed Auth ID before rendering actions', async () => {
    await renderConnected('/register?authId=bad')
    expect(await screen.findByText('This authentication request is invalid.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve and register' })).toBeNull()
  })

  it('approves an existing-node authentication request and removes the Auth ID', async () => {
    let payload: unknown
    server.use(
      http.post(`${BASE_URL}/api/v1/auth/approve`, async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({})
      }),
    )
    const { router } = await renderConnected(`/auth?authId=${authId}`)
    expect(screen.getByText('hskey-authreq-••••••••••••tuvwx')).toBeTruthy()
    expect(screen.queryByText(authId)).toBeNull()
    await fireEvent.click(screen.getByRole('button', { name: 'Approve re-authentication' }))
    await fireEvent.click(await screen.findByRole('button', { name: 'Confirm approval' }))
    await waitFor(() => expect(payload).toEqual({ authId }))
    await waitFor(() => expect(router.currentRoute.value.query).toEqual({ result: 'approved' }))
  })

  it('rejects a re-authentication request', async () => {
    let payload: unknown
    server.use(
      http.post(`${BASE_URL}/api/v1/auth/reject`, async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({})
      }),
    )
    const { router } = await renderConnected(`/auth?authId=${authId}`)
    await fireEvent.click(screen.getByRole('button', { name: 'Reject request' }))
    await fireEvent.click(await screen.findByRole('button', { name: 'Confirm rejection' }))
    await waitFor(() => expect(payload).toEqual({ authId }))
    await waitFor(() => expect(router.currentRoute.value.query).toEqual({ result: 'rejected' }))
  })
})
