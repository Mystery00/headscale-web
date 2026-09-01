# Node Authentication Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Nginx-directed Headscale node registration and re-authentication approval flows to the static Headscale Web SPA.

**Architecture:** A front Nginx temporarily redirects Headscale's nested authentication URLs to flat, base-path-aware SPA routes. The SPA validates the short-lived Auth ID, preserves the route through API-key connection, and calls Headscale 0.29.x auth APIs through a focused repository and Vue Query mutations.

**Tech Stack:** Vue 3, TypeScript, Vue Router, Pinia, TanStack Vue Query, Naive UI, MSW, Vitest, Vue Testing Library, Playwright, runtime Nginx.

**Spec:** `docs/superpowers/specs/2026-09-01-node-auth-approval-design.md`

## Global Constraints

- Support Headscale `0.29.x` using the checked-in `v0.29.3` API contract.
- Keep Headscale Web a static SPA; do not add a backend, database, cookie session, or hidden credential service.
- Support `/`, `/admin/`, and every valid runtime `APP_BASE_PATH` without rebuilding.
- Never persist or log Auth IDs; only read them from the active route and send them in authenticated request bodies.
- Validate Auth IDs as `hskey-authreq-` plus exactly 24 URL-safe characters.
- Do not automatically retry auth mutations.
- Render all user-facing copy through `en-US` and `zh-CN` locale files.
- Preserve Headscale OIDC routes; front-proxy interception is documented as manual Web/CLI authentication mode only.

## File Structure

- Create `src/domain/auth-id.ts`: Auth ID parsing, validation, and masking.
- Create `src/domain/internal-redirect.ts`: safe internal post-connection redirect normalization.
- Create `src/repositories/auth-repository.ts`: Headscale auth register, approve, and reject API boundary.
- Create `src/features/auth/AuthRequestPage.vue`: standalone registration and re-authentication UI.
- Create `tests/unit/auth-id.spec.ts`, `tests/unit/internal-redirect.spec.ts`, and `tests/unit/auth-repository.spec.ts`: domain and repository contracts.
- Create `tests/component/auth-request-page.spec.ts`: registration, approval, rejection, terminal, and error behavior.
- Modify `src/query/repositories.ts` and `src/query/use-headscale-mutations.ts`: expose auth operations and node invalidation.
- Modify `src/router/guards.ts`, `src/router/index.ts`, `src/features/connection/ConnectionPage.vue`, and `src/main.ts`: protected auth routes and safe connection recovery.
- Modify locale files, runtime Docker Nginx generation, MSW fixtures, E2E mock server, E2E specs, and deployment documentation.

---

### Task 1: Auth ID and internal redirect domain boundaries

**Files:**
- Create: `src/domain/auth-id.ts`
- Create: `src/domain/internal-redirect.ts`
- Create: `tests/unit/auth-id.spec.ts`
- Create: `tests/unit/internal-redirect.spec.ts`

**Interfaces:**
- Produces: `parseAuthId(value: unknown): string | null`
- Produces: `maskAuthId(authId: string): string`
- Produces: `safeInternalRedirect(value: unknown, fallback?: string): string`

- [ ] **Step 1: Write failing Auth ID tests**

```ts
import { describe, expect, it } from 'vitest'
import { maskAuthId, parseAuthId } from '@/domain/auth-id'

const valid = 'hskey-authreq-abcdefghijklmnopqrstuvwx'

describe('Auth ID', () => {
  it('accepts the Headscale 0.29 auth request format', () => {
    expect(parseAuthId(valid)).toBe(valid)
  })

  it.each([
    undefined,
    '',
    'hskey-authreq-short',
    'hskey-authreq-abcdefghijklmnopqrstuvw!',
    ['hskey-authreq-abcdefghijklmnopqrstuvwx'],
  ])('rejects invalid value %j', (value) => {
    expect(parseAuthId(value)).toBeNull()
  })

  it('masks the capability while retaining a diagnostic suffix', () => {
    expect(maskAuthId(valid)).toBe('hskey-authreq-鈥⑩€⑩€⑩€⑩€⑩€⑩€⑩€⑩€⑩€⑩€⑩€uvwx')
  })
})
```

- [ ] **Step 2: Run the Auth ID test and verify failure**

Run: `pnpm vitest run tests/unit/auth-id.spec.ts`

Expected: FAIL because `@/domain/auth-id` does not exist.

- [ ] **Step 3: Implement Auth ID validation and masking**

```ts
const AUTH_ID_PREFIX = 'hskey-authreq-'
const AUTH_ID_PATTERN = /^hskey-authreq-[A-Za-z0-9_-]{24}$/

export function parseAuthId(value: unknown): string | null {
  return typeof value === 'string' && AUTH_ID_PATTERN.test(value) ? value : null
}

export function maskAuthId(authId: string): string {
  return `${AUTH_ID_PREFIX}${'鈥?.repeat(12)}${authId.slice(-5)}`
}
```

- [ ] **Step 4: Write failing safe redirect tests**

```ts
import { describe, expect, it } from 'vitest'
import { safeInternalRedirect } from '@/domain/internal-redirect'

describe('safeInternalRedirect', () => {
  it.each([
    ['/register?authId=abc', '/register?authId=abc'],
    ['/auth?authId=abc#result', '/auth?authId=abc#result'],
    ['/nodes?userId=1', '/nodes?userId=1'],
  ])('keeps internal target %s', (value, expected) => {
    expect(safeInternalRedirect(value)).toBe(expected)
  })

  it.each([
    'https://evil.example/register',
    '//evil.example/register',
    '/\\evil.example/register',
    'javascript:alert(1)',
    '',
    undefined,
  ])('rejects external or malformed target %j', (value) => {
    expect(safeInternalRedirect(value)).toBe('/')
  })
})
```

- [ ] **Step 5: Run the redirect test and verify failure**

Run: `pnpm vitest run tests/unit/internal-redirect.spec.ts`

Expected: FAIL because `@/domain/internal-redirect` does not exist.

- [ ] **Step 6: Implement safe internal redirect normalization**

```ts
const INTERNAL_ORIGIN = 'https://headscale-web.invalid'

export function safeInternalRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }
  try {
    const parsed = new URL(value, INTERNAL_ORIGIN)
    if (parsed.origin !== INTERNAL_ORIGIN) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
```

- [ ] **Step 7: Run both domain tests**

Run: `pnpm vitest run tests/unit/auth-id.spec.ts tests/unit/internal-redirect.spec.ts`

Expected: PASS.

- [ ] **Step 8: Commit the domain boundaries**

```powershell
git add src/domain/auth-id.ts src/domain/internal-redirect.ts tests/unit/auth-id.spec.ts tests/unit/internal-redirect.spec.ts
git commit -m "feat: validate node auth requests"
```

---

### Task 2: Headscale authentication repository and mutations

**Files:**
- Create: `src/repositories/auth-repository.ts`
- Create: `tests/unit/auth-repository.spec.ts`
- Modify: `src/query/repositories.ts`
- Modify: `src/query/use-headscale-mutations.ts`

**Interfaces:**
- Consumes: `HeadscaleHttp`, generated `v1Auth*` schemas, `mapNode`
- Produces: `AuthRepository.register(input: { authId: string; userName: string }): Promise<Node>`
- Produces: `AuthRepository.approve(authId: string): Promise<void>`
- Produces: `AuthRepository.reject(authId: string): Promise<void>`
- Produces: `useRegisterAuthMutation`, `useApproveAuthMutation`, `useRejectAuthMutation`

- [ ] **Step 1: Write failing repository request-shape tests**

Create tests that install MSW handlers for all three endpoints and assert exact JSON bodies:

```ts
const authId = 'hskey-authreq-abcdefghijklmnopqrstuvwx'

it('registers a pending node under a user and maps the returned node', async () => {
  let payload: unknown
  server.use(
    http.post(`${BASE_URL}/api/v1/auth/register`, async ({ request }) => {
      payload = await request.json()
      return HttpResponse.json({ node })
    }),
  )
  const registered = await repo().register({ authId, userName: 'alice' })
  expect(payload).toEqual({ authId, user: 'alice' })
  expect(registered.id).toBe('42')
})

it.each([
  ['approve', '/api/v1/auth/approve'],
  ['reject', '/api/v1/auth/reject'],
] as const)('sends %s with only the Auth ID', async (method, path) => {
  let payload: unknown
  server.use(
    http.post(`${BASE_URL}${path}`, async ({ request }) => {
      payload = await request.json()
      return HttpResponse.json({})
    }),
  )
  await repo()[method](authId)
  expect(payload).toEqual({ authId })
})

it('rejects a register response without a node', async () => {
  server.use(http.post(`${BASE_URL}/api/v1/auth/register`, () => HttpResponse.json({})))
  await expect(repo().register({ authId, userName: 'alice' })).rejects.toThrow('missing node')
})
```

- [ ] **Step 2: Run the repository test and verify failure**

Run: `pnpm vitest run tests/unit/auth-repository.spec.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement the focused repository**

```ts
export interface AuthRepository {
  register(input: { authId: string; userName: string }): Promise<Node>
  approve(authId: string): Promise<void>
  reject(authId: string): Promise<void>
}

export function createAuthRepository(http: HeadscaleHttp): AuthRepository {
  return {
    async register(input) {
      const body = (await http.request({
        path: '/api/v1/auth/register',
        method: 'POST',
        body: { authId: input.authId, user: input.userName },
        authenticated: true,
      })) as components['schemas']['v1AuthRegisterResponse'] | undefined
      if (!body?.node) throw new Error('missing node')
      return mapNode(body.node)
    },
    async approve(authId) {
      await http.request({
        path: '/api/v1/auth/approve',
        method: 'POST',
        body: { authId },
        authenticated: true,
      })
    },
    async reject(authId) {
      await http.request({
        path: '/api/v1/auth/reject',
        method: 'POST',
        body: { authId },
        authenticated: true,
      })
    },
  }
}
```

- [ ] **Step 4: Expose the repository and add non-retrying mutations**

Add `auth: createAuthRepository(http)` to `createAppRepositories()`. Add:

```ts
export function useRegisterAuthMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { authId: string; userName: string }) =>
      createAppRepositories().auth.register(input),
    retry: false,
    onSuccess: () => invalidateNodes(queryClient),
  })
}

export function useApproveAuthMutation() {
  return useMutation({
    mutationFn: (authId: string) => createAppRepositories().auth.approve(authId),
    retry: false,
  })
}

export function useRejectAuthMutation() {
  return useMutation({
    mutationFn: (authId: string) => createAppRepositories().auth.reject(authId),
    retry: false,
  })
}
```

- [ ] **Step 5: Run repository and type checks**

Run: `pnpm vitest run tests/unit/auth-repository.spec.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the API boundary**

```powershell
git add src/repositories/auth-repository.ts src/query/repositories.ts src/query/use-headscale-mutations.ts tests/unit/auth-repository.spec.ts
git commit -m "feat: add node auth API operations"
```

---

### Task 3: Preserve protected routes through API-key connection

**Files:**
- Modify: `src/router/guards.ts`
- Modify: `src/features/connection/ConnectionPage.vue`
- Modify: `src/main.ts`
- Modify: `tests/component/connection-page.spec.ts`
- Create: `tests/unit/router-guards.spec.ts`

**Interfaces:**
- Consumes: `safeInternalRedirect(value, fallback)`
- Produces: protected-route redirects shaped as `{ path: '/connect', query: { redirect: to.fullPath } }`

- [ ] **Step 1: Write a failing router guard test**

```ts
it('preserves the full protected target when credentials are missing', async () => {
  credentialStore.clear()
  useSettingsStore().update({ baseUrl: null })
  const router = createAppRouter()
  await router.push('/nodes?userId=7')
  expect(router.currentRoute.value.path).toBe('/connect')
  expect(router.currentRoute.value.query.redirect).toBe('/nodes?userId=7')
})
```

- [ ] **Step 2: Run the guard test and verify failure**

Run: `pnpm vitest run tests/unit/router-guards.spec.ts`

Expected: FAIL because the current guard redirects with the string `/connect` and drops the target.

- [ ] **Step 3: Preserve `to.fullPath` in the guard**

```ts
if (!credentialStore.getApiKey() || !settings.baseUrl) {
  return { path: '/connect', query: { redirect: to.fullPath } }
}
```

Keep `/connect` itself exempt to avoid a loop.

- [ ] **Step 4: Write failing connection return tests**

Extend the connection-page test router with `/nodes` and add:

```ts
it('returns to a safe preserved route after connecting', async () => {
  const { router } = await renderPage('/connect?redirect=%2Fnodes%3FuserId%3D7')
  await completeValidConnection()
  await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/nodes?userId=7'))
})

it.each(['https://evil.example/', '//evil.example/', '/\\evil.example/'])(
  'falls back home for unsafe redirect %s',
  async (redirect) => {
    const { router } = await renderPage(`/connect?redirect=${encodeURIComponent(redirect)}`)
    await completeValidConnection()
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/'))
  },
)
```

Refactor only the test helper needed to accept an initial path and fill a valid URL/key; do not change production behavior in the test setup.

- [ ] **Step 5: Run connection tests and verify failure**

Run: `pnpm vitest run tests/component/connection-page.spec.ts`

Expected: the safe route test FAILS because connection always pushes `/`.

- [ ] **Step 6: Return safely after connection and preserve the active route on global 401**

In `ConnectionPage.vue`, add `useRoute`, normalize the query value, and replace the fixed home navigation:

```ts
const route = useRoute()
// after credentials are stored
await router.push(safeInternalRedirect(route.query.redirect))
```

In `main.ts`, preserve the current protected route before sending the user back to connection:

```ts
onUnauthorized() {
  queryClient.clear()
  const current = router.currentRoute.value
  const redirect = current.path === '/connect' ? '/' : current.fullPath
  void router.push({ path: '/connect', query: { redirect } })
}
```

- [ ] **Step 7: Run focused tests and typecheck**

Run: `pnpm vitest run tests/unit/router-guards.spec.ts tests/component/connection-page.spec.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 8: Commit connection recovery**

```powershell
git add src/router/guards.ts src/features/connection/ConnectionPage.vue src/main.ts tests/unit/router-guards.spec.ts tests/component/connection-page.spec.ts
git commit -m "feat: restore protected route after connection"
```

---

### Task 4: New-node registration and rejection page

**Files:**
- Create: `src/features/auth/AuthRequestPage.vue`
- Modify: `src/router/index.ts`
- Modify: `src/i18n/locales/en-US.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `tests/msw/handlers.ts`
- Create: `tests/component/auth-request-page.spec.ts`

**Interfaces:**
- Consumes: `parseAuthId`, `maskAuthId`, `useUsersQuery`, `useRegisterAuthMutation`, `useRejectAuthMutation`
- Produces: route `/register?authId=<id>`
- Produces: terminal route `/register?result=registered` or `/register?result=rejected`

- [ ] **Step 1: Add failing component tests for validation and registration**

Add default MSW handlers for register/reject and tests with a valid Auth ID:

```ts
const authId = 'hskey-authreq-abcdefghijklmnopqrstuvwx'

it('rejects a missing or malformed Auth ID before rendering actions', async () => {
  await renderConnected('/register?authId=bad')
  expect(await screen.findByText('This authentication request is invalid.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Approve and register' })).toBeNull()
})

it('registers the request under the selected user', async () => {
  let payload: unknown
  server.use(
    http.post(`${BASE_URL}/api/v1/auth/register`, async ({ request }) => {
      payload = await request.json()
      return HttpResponse.json({ node })
    }),
  )
  const { router } = await renderConnected(`/register?authId=${authId}`)
  await fireEvent.click(await screen.findByRole('combobox', { name: 'Target user' }))
  await fireEvent.click(await screen.findByText('alice'))
  await fireEvent.click(screen.getByRole('button', { name: 'Approve and register' }))
  await fireEvent.click(await screen.findByRole('button', { name: 'Confirm registration' }))
  await waitFor(() => expect(payload).toEqual({ authId, user: 'alice' }))
  expect(await screen.findByText('alice-laptop')).toBeTruthy()
  expect(router.currentRoute.value.query).toEqual({ result: 'registered' })
})
```

Also assert the full Auth ID is absent from rendered text and the masked value is present.

- [ ] **Step 2: Run the registration component tests and verify failure**

Run: `pnpm vitest run tests/component/auth-request-page.spec.ts`

Expected: FAIL because the page and route do not exist.

- [ ] **Step 3: Add registration page state and route**

Add a standalone route outside `AppShell`:

```ts
{ path: '/register', component: AuthRequestPage, props: { mode: 'register' } }
```

Implement these explicit states in `AuthRequestPage.vue`:

```ts
type Result = 'registered' | 'rejected' | null
const authId = computed(() => parseAuthId(route.query.authId))
const result = ref<Result>(
  route.query.result === 'registered' || route.query.result === 'rejected'
    ? route.query.result
    : null,
)
const selectedUserName = ref<string | null>(null)
const registeredNode = ref<Node | null>(null)
const confirmRegister = ref(false)
const confirmReject = ref(false)
const pending = computed(() => register.isPending.value || reject.isPending.value)
```

The page must:

- Render a standalone responsive card using existing admin theme variables.
- Show a warning that Headscale cannot expose pending node details before registration.
- Show `maskAuthId(authId)` only when valid.
- Disable registration until a user is selected.
- Use `ConfirmDialog` with the selected username in the confirmation message.
- Call `register.mutateAsync({ authId, userName: selectedUserName })`.
- Store the returned node only in component-local memory.
- Call `router.replace({ path: '/register', query: { result: 'registered' } })` after success.
- Offer a `/nodes` link after registration.

- [ ] **Step 4: Add rejection behavior and stale-request errors**

Use the same `/api/v1/auth/reject` mutation. Confirm before rejection, then:

```ts
await reject.mutateAsync(authId.value)
result.value = 'rejected'
await router.replace({ path: '/register', query: { result: 'rejected' } })
```

Map `AppApiError.kind` to localized page messages. Distinguish `not-found`, `validation`, `unauthorized`/`forbidden`, `timeout`, `network`/`cors`, `conflict`, and fallback failure. Leave actions available after recoverable network/timeout failures.

- [ ] **Step 5: Add complete English and Simplified Chinese copy**

Add an `authRequests` locale section containing titles, descriptions, target-user label, safety warning, masked-ID label, register/approve/reject labels, confirmation text, terminal messages, node summary labels, and every error message used in Step 4. Keep all page source free of hard-coded English and Chinese user-facing strings.

- [ ] **Step 6: Complete component coverage**

Add tests with concrete setup and assertions:

```ts
it('rejects a new registration request after confirmation', async () => {
  let payload: unknown
  server.use(http.post(`${BASE_URL}/api/v1/auth/reject`, async ({ request }) => {
    payload = await request.json()
    return HttpResponse.json({})
  }))
  const { router } = await renderConnected(`/register?authId=${authId}`)
  await fireEvent.click(screen.getByRole('button', { name: 'Reject request' }))
  await fireEvent.click(await screen.findByRole('button', { name: 'Confirm rejection' }))
  await waitFor(() => expect(payload).toEqual({ authId }))
  expect(router.currentRoute.value.query).toEqual({ result: 'rejected' })
})

it('shows an expired message for a 404 response', async () => {
  server.use(http.post(`${BASE_URL}/api/v1/auth/register`, () =>
    HttpResponse.json({ message: 'not found' }, { status: 404 })))
  await renderRegistrationAndSelectAlice(authId)
  await confirmRegistration()
  expect(await screen.findByText('This authentication request has expired or was already handled.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Approve and register' })).toBeTruthy()
})

it('retains actions after a network failure', async () => {
  server.use(http.post(`${BASE_URL}/api/v1/auth/reject`, () => HttpResponse.error()))
  await renderConnected(`/register?authId=${authId}`)
  await fireEvent.click(screen.getByRole('button', { name: 'Reject request' }))
  await fireEvent.click(await screen.findByRole('button', { name: 'Confirm rejection' }))
  expect(await screen.findByText('Could not reach Headscale. Try again.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Reject request' })).toBeTruthy()
})
```

For the pending-state test, hold the MSW response with a promise, assert both action buttons are disabled, resolve the promise, and assert the terminal state. Add the existing source-file check to prove the Vue file contains no hard-coded English or Chinese user-facing strings.

- [ ] **Step 7: Run registration page tests and build checks**

Run: `pnpm vitest run tests/component/auth-request-page.spec.ts && pnpm typecheck && pnpm build`

Expected: PASS.

- [ ] **Step 8: Commit new-node registration**

```powershell
git add src/features/auth/AuthRequestPage.vue src/router/index.ts src/i18n/locales/en-US.ts src/i18n/locales/zh-CN.ts tests/msw/handlers.ts tests/component/auth-request-page.spec.ts
git commit -m "feat: approve new node registrations"
```

---

### Task 5: Existing-node re-authentication approval and rejection

**Files:**
- Modify: `src/features/auth/AuthRequestPage.vue`
- Modify: `src/router/index.ts`
- Modify: `src/i18n/locales/en-US.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `tests/component/auth-request-page.spec.ts`

**Interfaces:**
- Consumes: registration page terminal/error patterns and `useApproveAuthMutation`
- Produces: route `/auth?authId=<id>`
- Produces: terminal route `/auth?result=approved` or `/auth?result=rejected`

- [ ] **Step 1: Write failing re-authentication tests**

```ts
it('approves an existing-node authentication request', async () => {
  let payload: unknown
  server.use(
    http.post(`${BASE_URL}/api/v1/auth/approve`, async ({ request }) => {
      payload = await request.json()
      return HttpResponse.json({})
    }),
  )
  const { router } = await renderConnected(`/auth?authId=${authId}`)
  await fireEvent.click(screen.getByRole('button', { name: 'Approve re-authentication' }))
  await fireEvent.click(await screen.findByRole('button', { name: 'Confirm approval' }))
  await waitFor(() => expect(payload).toEqual({ authId }))
  expect(router.currentRoute.value.query).toEqual({ result: 'approved' })
})

it('rejects an existing-node authentication request', async () => {
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
  expect(router.currentRoute.value.query).toEqual({ result: 'rejected' })
})
```

Also verify there is no target-user selector on `/auth`.

- [ ] **Step 2: Run the focused re-authentication tests and verify failure**

Run: `pnpm vitest run tests/component/auth-request-page.spec.ts -t "existing-node"`

Expected: FAIL because `/auth` is not registered and the page has only registration mode.

- [ ] **Step 3: Add `/auth` route and mode-specific behavior**

```ts
{ path: '/auth', component: AuthRequestPage, props: { mode: 'reauth' } }
```

Expand page props and result types:

```ts
const props = defineProps<{ mode: 'register' | 'reauth' }>()
type Result = 'registered' | 'approved' | 'rejected' | null
```

For `reauth` mode:

- Do not load or render users.
- Approve through `approve.mutateAsync(authId)`.
- Reject through the existing reject mutation.
- Use mode-specific confirmation and success copy.
- Replace the route query with only `{ result: 'approved' }` or `{ result: 'rejected' }`.
- Tell the administrator to return to the Tailscale client and wait for completion.

- [ ] **Step 4: Run all auth page tests**

Run: `pnpm vitest run tests/component/auth-request-page.spec.ts`

Expected: PASS for registration, approval, rejection, validation, locking, terminal, and error cases.

- [ ] **Step 5: Commit re-authentication support**

```powershell
git add src/features/auth/AuthRequestPage.vue src/router/index.ts src/i18n/locales/en-US.ts src/i18n/locales/zh-CN.ts tests/component/auth-request-page.spec.ts
git commit -m "feat: approve node reauthentication"
```

---

### Task 6: Runtime SPA routes and front-Nginx deployment contract

**Files:**
- Modify: `deploy/docker-entrypoint.sh`
- Modify: `tests/unit/docker-runtime-base.spec.ts`
- Modify: `tests/unit/base-path.spec.ts`
- Modify: `docs/deploy.md`
- Modify: `docs/design.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: flat SPA paths `/register` and `/auth`
- Produces: runtime container support for `<APP_BASE_PATH>register` and `<APP_BASE_PATH>auth`
- Produces: documented external Nginx redirect rules

- [ ] **Step 1: Extend failing base-path and Docker route tests**

In the router test, assert both routes resolve under an injected base:

```ts
const router = createAppRouter('/admin/')
expect(router.resolve('/register?authId=x').href).toBe('/admin/register?authId=x')
expect(router.resolve('/auth?authId=x').href).toBe('/admin/auth?authId=x')
```

In Docker tests, add root and subpath checks:

```ts
expect((await fetch(`${origin}/register?authId=x`)).status).toBe(200)
expect((await fetch(`${origin}/auth?authId=x`)).status).toBe(200)
expect((await fetch(`${origin}/admin/register?authId=x`)).status).toBe(200)
expect((await fetch(`${origin}/admin/auth?authId=x`)).status).toBe(200)
```

Also assert `/register/x` and `/admin/register/x` remain 404 so the container does not silently accept nested routes.

- [ ] **Step 2: Run route tests and verify failure**

Run: `pnpm vitest run tests/unit/base-path.spec.ts`

Run Docker test when Docker is available: `$env:RUN_DOCKER_TESTS='1'; pnpm vitest run tests/unit/docker-runtime-base.spec.ts`

Expected: flat auth routes FAIL until runtime Nginx allows them.

- [ ] **Step 3: Add the two routes to runtime Nginx generation**

Change the route loop exactly from:

```sh
for route in connect users nodes routes preauth-keys settings; do
```

to:

```sh
for route in connect users nodes routes preauth-keys settings register auth; do
```

Keep nested unsupported paths returning 404.

- [ ] **Step 4: Document root and `/admin/` front-proxy redirects**

Add an Nginx example with strict Auth ID matching and temporary redirects:

```nginx
location ~ ^/register/(hskey-authreq-[A-Za-z0-9_-]{24})$ {
    add_header Cache-Control "no-store" always;
    return 302 /admin/register?authId=$1;
}

location ~ ^/auth/(hskey-authreq-[A-Za-z0-9_-]{24})$ {
    add_header Cache-Control "no-store" always;
    return 302 /admin/auth?authId=$1;
}
```

Document these requirements next to the example:

- Substitute `/admin/` with the actual `APP_BASE_PATH`; root deployment targets `/register` and `/auth`.
- Route `/api/*`, `/version`, and all control/Noise/WebSocket paths to Headscale.
- Do not use 301 or 308 for short-lived Auth IDs.
- Do not intercept `/register/confirm/*` or `/oidc/callback`.
- Do not enable this interception when using Headscale's native OIDC authentication flow.
- Pending requests normally expire after about 15 minutes and disappear on Headscale restart.

Update the architecture route list and README features/limitations consistently.

- [ ] **Step 5: Run route, formatting, and documentation checks**

Run: `pnpm vitest run tests/unit/base-path.spec.ts`

Run: `pnpm format:check`

If Docker is available, run: `$env:RUN_DOCKER_TESTS='1'; pnpm vitest run tests/unit/docker-runtime-base.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit deployment support**

```powershell
git add deploy/docker-entrypoint.sh tests/unit/docker-runtime-base.spec.ts tests/unit/base-path.spec.ts docs/deploy.md docs/design.md README.md
git commit -m "docs: add node auth proxy deployment"
```

---

### Task 7: End-to-end authentication flows and complete validation

**Files:**
- Modify: `tests/e2e/mock-headscale.mjs`
- Modify: `tests/e2e/admin-pages.spec.ts`
- Modify: `tests/msw/handlers.ts` to keep shared auth fixtures aligned with E2E behavior

**Interfaces:**
- Consumes: final `/register` and `/auth` pages and all three auth endpoints
- Produces: browser-level evidence for connection recovery, registration, approval, rejection, and node visibility

- [ ] **Step 1: Extend the E2E mock server state and endpoints**

Add `authRequests` request tracking to the resettable mock state. Implement exact handlers:

```js
async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

if (req.method === 'POST' && url.pathname === '/api/v1/auth/register') {
  const body = await readJson(req)
  if (!state.authRequests.includes(body.authId)) return json(res, 404, { message: 'not found' })
  const user = state.users.find((candidate) => candidate.name === body.user)
  if (!user) return json(res, 400, { message: 'user not found' })
  const node = makeRegisteredNode(user)
  state.nodes.push(node)
  return json(res, 200, { node })
}

if (req.method === 'POST' && url.pathname === '/api/v1/auth/approve') {
  const body = await readJson(req)
  if (!state.authRequests.includes(body.authId)) return json(res, 404, { message: 'not found' })
  state.approvedAuthIds.push(body.authId)
  return json(res, 200, {})
}

if (req.method === 'POST' && url.pathname === '/api/v1/auth/reject') {
  const body = await readJson(req)
  if (!state.authRequests.includes(body.authId)) return json(res, 404, { message: 'not found' })
  state.rejectedAuthIds.push(body.authId)
  return json(res, 200, {})
}
```

Return 404 when the test state marks an Auth ID missing, and 400 when the user does not exist. Keep the existing Bearer-key check on all endpoints.

- [ ] **Step 2: Write failing browser tests**

Add tests using `hskey-authreq-abcdefghijklmnopqrstuvwx`:

```ts
test('connects and returns to a new-node registration request', async ({ page }) => {
  await page.goto(`/register?authId=${authId}`)
  await expect(page).toHaveURL(/\/connect\?redirect=/)
  await fillConnection(page)
  await expect(page).toHaveURL(new RegExp(`/register\\?authId=${authId}$`))
  await page.getByRole('combobox', { name: 'Target user' }).click()
  await page.getByText('alice', { exact: true }).click()
  await page.getByRole('button', { name: 'Approve and register' }).click()
  await page.getByRole('button', { name: 'Confirm registration' }).click()
  await expect(page).toHaveURL(/\/register\?result=registered$/)
  await expect(page.getByText('registered-laptop')).toBeVisible()
})

test('approves and rejects re-authentication requests', async ({ page }) => {
  await connect(page)
  await page.goto(`/auth?authId=${authId}`)
  await page.getByRole('button', { name: 'Approve re-authentication' }).click()
  await page.getByRole('button', { name: 'Confirm approval' }).click()
  await expect(page).toHaveURL(/\/auth\?result=approved$/)

  const secondAuthId = 'hskey-authreq-zyxwvutsrqponmlkjihgfedc'
  await page.goto(`/auth?authId=${secondAuthId}`)
  await page.getByRole('button', { name: 'Reject request' }).click()
  await page.getByRole('button', { name: 'Confirm rejection' }).click()
  await expect(page).toHaveURL(/\/auth\?result=rejected$/)
})
```

Add a registration invalidation check: load `/nodes` before registration, complete registration, navigate back to `/nodes`, and assert the newly created node appears.

- [ ] **Step 3: Run the E2E tests and verify failure before mock/page completion**

Run: `pnpm test:e2e -- tests/e2e/admin-pages.spec.ts`

Expected: new authentication tests FAIL until mock behavior and final selectors align.

- [ ] **Step 4: Complete mock behavior and selectors until E2E passes**

Run: `pnpm test:e2e -- tests/e2e/admin-pages.spec.ts`

Expected: PASS, including mobile containment for `/register` and `/auth` at 390px width.

- [ ] **Step 5: Run the complete quality gate**

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm api:check
pnpm test:e2e
```

Expected: every command exits 0 and `pnpm api:check` leaves no generated API diff.

- [ ] **Step 6: Inspect the final diff and repository state**

```powershell
git diff --check
git status --short
git log --oneline -8
```

Expected: no whitespace errors, only intended uncommitted files if validation produced artifacts, and one focused commit per completed task.

- [ ] **Step 7: Commit final E2E coverage**

```powershell
git add tests/e2e/mock-headscale.mjs tests/e2e/admin-pages.spec.ts tests/msw/handlers.ts
git commit -m "test: cover node auth approval flows"
```



