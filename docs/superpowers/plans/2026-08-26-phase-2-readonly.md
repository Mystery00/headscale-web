# Phase 2 Read-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only Dashboard, Users, Nodes, Routes, and PreAuth Keys views that load through repositories and Vue Query.

**Architecture:** Keep Pinia for client settings only. Map Headscale 0.29 DTOs into domain models, fetch them through repositories, and cache them in TanStack Vue Query. Routes are derived from node lists. Dashboard reuses the same queries and must not add extra API calls.

**Tech Stack:** Existing Vue 3 + Naive UI + Vue Query + MSW + Vitest stack from Phase 1.

**Spec:** [docs/design.md](../../design.md) sections 11–17, 14.1, 14.3–14.7, 15, 24 Phase 2.

## Global Constraints

- Read-only only. Do not implement create/rename/delete/expire/approve actions.
- Components must not call `fetch` or touch generated OpenAPI types.
- All uint64 IDs stay strings.
- Node tags come from `tags`, never deprecated tag fields.
- `GET /api/v1/preauthkey` is called once, never per user.
- Full PreAuthKey plaintext must not enter Vue Query, Pinia, storage, or logs. List mapper keeps `keyPreview` only.
- Query keys, staleTime 5s, gcTime 5m, refetchOnWindowFocus with 5s throttle, polling from settings, pause when the tab is hidden.
- Copy goes through Vue I18n. No hardcoded user-facing English/Chinese in components.
- Continue targeting Headscale 0.29.x only.

## File Map

```text
src/domain/user.ts
src/domain/node.ts
src/domain/route.ts
src/domain/preauth-key.ts
src/domain/register-method.ts
src/mappers/user-mapper.ts
src/mappers/node-mapper.ts
src/mappers/route-mapper.ts
src/mappers/preauth-key-mapper.ts
src/repositories/users-repository.ts
src/repositories/nodes-repository.ts
src/repositories/preauth-keys-repository.ts
src/query/client.ts
src/query/keys.ts
src/query/use-headscale-queries.ts
src/features/shell/AppNav.vue
src/features/shell/StatusBar.vue
src/features/dashboard/DashboardPage.vue
src/features/users/UsersPage.vue
src/features/users/UserDetailDrawer.vue
src/features/nodes/NodesPage.vue
src/features/nodes/NodeDetailDrawer.vue
src/features/routes/RoutesPage.vue
src/features/preauth-keys/PreAuthKeysPage.vue
src/composables/use-masked-key.ts
tests/unit/user-mapper.spec.ts
tests/unit/node-mapper.spec.ts
tests/unit/route-mapper.spec.ts
tests/unit/preauth-key-mapper.spec.ts
tests/unit/users-repository.spec.ts
tests/unit/nodes-repository.spec.ts
tests/unit/preauth-keys-repository.spec.ts
tests/unit/query-keys.spec.ts
tests/component/dashboard-page.spec.ts
tests/component/users-page.spec.ts
tests/component/nodes-page.spec.ts
tests/component/routes-page.spec.ts
tests/component/preauth-keys-page.spec.ts
```

Replace `src/features/shell/ConnectedHomePage.vue` with `DashboardPage`.

---

### Task 1: Domain models and mappers

**Files:**
- Create: the `src/domain/*` and `src/mappers/*` files above
- Test: `tests/unit/*-mapper.spec.ts`

**Interfaces:**

```ts
export interface User {
  id: string
  name: string
  displayName: string
  email: string
  provider: string
  providerId: string
  profilePictureUrl: string
  createdAt: Date
}

export type RegisterMethod = 'auth-key' | 'cli' | 'oidc' | 'unspecified'

export interface PreAuthKeySummary {
  id: string
  keyPreview: string | null
}

export interface Node {
  id: string
  name: string
  givenName: string
  machineKey: string
  nodeKey: string
  discoKey: string
  ipAddresses: string[]
  user: User
  lastSeen: Date | null
  expiry: Date | null
  createdAt: Date
  registerMethod: RegisterMethod
  online: boolean
  tags: string[]
  approvedRoutes: string[]
  availableRoutes: string[]
  subnetRoutes: string[]
  preAuthKey: PreAuthKeySummary | null
}

export interface RouteView {
  id: string // `${nodeId}:${prefix}`
  nodeId: string
  nodeName: string
  userName: string
  prefix: string
  advertised: boolean
  approved: boolean
  serving: boolean
  exitRoute: boolean
}

export type PreAuthKeyState = 'active' | 'used' | 'expired'

export interface PreAuthKey {
  id: string
  user: User | null
  keyPreview: string | null
  reusable: boolean
  ephemeral: boolean
  used: boolean
  expiration: Date | null
  createdAt: Date
  aclTags: string[]
  state: PreAuthKeyState
}

export function mapUser(dto: components['schemas']['v1User']): User
export function mapNode(dto: components['schemas']['v1Node']): Node
export function mapRoutesFromNodes(nodes: Node[]): RouteView[]
export function mapPreAuthKey(dto: components['schemas']['v1PreAuthKey'], now?: Date): PreAuthKey
export function previewKey(key: string | undefined): string | null
```

Mapping rules:

- Missing strings become `''`. Missing arrays become `[]`. Missing IDs throw `Error('missing id')`.
- `profilePicUrl` → `profilePictureUrl`.
- Dates parse ISO strings; invalid/empty → `null` except `createdAt`, which throws if missing.
- Register method map: `REGISTER_METHOD_AUTH_KEY` → `auth-key`, `CLI` → `cli`, `OIDC` → `oidc`, anything else → `unspecified`.
- Use `tags` only.
- `previewKey('hskey-abcdefghijklmnopqrstuvwxyz')` → first 4 + `…` + last 4. Empty → `null`.
- PreAuthKey `state`: `used` if `used`; else `expired` if `expiration <= now`; else `active`.
- Route flags: advertised ∈ `availableRoutes`, approved ∈ `approvedRoutes`, serving ∈ `subnetRoutes`, exit if prefix is `0.0.0.0/0` or `::/0`.
- Exit IPv4/IPv6 remain separate `RouteView` rows. Grouping is a later UI concern.

- [ ] **Step 1: Write failing mapper tests** covering happy path, missing id, `profilePicUrl`, register method, tags-only, key preview, used/expired/active, and route flag derivation including both exit prefixes.

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm test -- tests/unit/user-mapper.spec.ts tests/unit/node-mapper.spec.ts tests/unit/route-mapper.spec.ts tests/unit/preauth-key-mapper.spec.ts
```

Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement the domain types and mappers**

- [ ] **Step 4: Re-run tests and commit**

```bash
git add src/domain src/mappers tests/unit/*-mapper.spec.ts
git commit -m "feat: map Headscale 0.29 DTOs to domain models"
```

---

### Task 2: Read-only repositories

**Files:**
- Create: `src/repositories/users-repository.ts`, `src/repositories/nodes-repository.ts`, `src/repositories/preauth-keys-repository.ts`
- Modify: `tests/msw/handlers.ts`
- Test: `tests/unit/users-repository.spec.ts`, `tests/unit/nodes-repository.spec.ts`, `tests/unit/preauth-keys-repository.spec.ts`

**Interfaces:**

```ts
export interface UsersRepository {
  list(filters?: { id?: string; name?: string; email?: string }): Promise<User[]>
}

export interface NodesRepository {
  list(filters?: { userName?: string }): Promise<Node[]>
  get(nodeId: string): Promise<Node>
}

export interface PreAuthKeysRepository {
  list(): Promise<PreAuthKey[]>
}
```

HTTP:

- Users: `GET /api/v1/user` with optional query `id` / `name` / `email`.
- Nodes: `GET /api/v1/node` with optional `user`; `GET /api/v1/node/{nodeId}` with encoded id.
- PreAuthKeys: `GET /api/v1/preauthkey` once. No user loop.
- All authenticated. Parse generated response wrappers `users` / `nodes` / `node` / `preAuthKeys`.

- [ ] **Step 1: Write failing MSW tests** that assert method, path, query, Authorization header, mapping, and that preauth list is a single request.

- [ ] **Step 2: Run tests and confirm they fail**

- [ ] **Step 3: Implement repositories**

- [ ] **Step 4: Re-run tests and commit**

```bash
git commit -m "feat: add read-only users, nodes, and preauth repositories"
```

---

### Task 3: Vue Query wiring and app shell

**Files:**
- Create: `src/query/client.ts`, `src/query/keys.ts`, `src/query/use-headscale-queries.ts`, `src/features/shell/AppNav.vue`, `src/features/shell/StatusBar.vue`
- Modify: `src/main.ts`, `src/features/shell/AppShell.vue`, `src/router/index.ts`, locale files
- Test: `tests/unit/query-keys.spec.ts`

**Interfaces:**

```ts
export const queryKeys = {
  systemVersion: ['system', 'version'] as const,
  systemHealth: ['system', 'health'] as const,
  users: (filters?: { id?: string; name?: string; email?: string }) => ['users', filters ?? {}] as const,
  nodes: (filters?: { userName?: string }) => ['nodes', filters ?? {}] as const,
  node: (nodeId: string) => ['node', nodeId] as const,
  preAuthKeys: ['preAuthKeys'] as const,
}

export function createAppQueryClient(): QueryClient
export function useUsersQuery(filters?: { id?: string; name?: string; email?: string })
export function useNodesQuery(filters?: { userName?: string })
export function useNodeQuery(nodeId: string)
export function usePreAuthKeysQuery()
export function useSystemVersionQuery()
export function useSystemHealthQuery()
export function useRefreshAll()
```

Query client defaults: `staleTime: 5_000`, `gcTime: 5 * 60_000`, `refetchOnWindowFocus: true`, `refetchInterval` from `settings.pollingEnabled ? settings.pollingIntervalMs : false`, `refetchIntervalInBackground: false`.

`useRefreshAll()` invalidates `['users']`, `['nodes']`, `['preAuthKeys']`, `['system']`.

Shell: desktop left nav + header status (URL, version, health, refresh, language, theme, disconnect). Mobile: collapse nav into a drawer. Routes:

```text
/            Dashboard
/users       Users
/nodes       Nodes
/routes      Routes
/preauth-keys PreAuth Keys
```

Keep `/connect` public. Settings stays a Phase 4 page; language/theme/refresh live in the header now.

- [ ] **Step 1: Write query-key tests**

- [ ] **Step 2: Implement client, composables, nav, status bar, routes**

- [ ] **Step 3: Run unit tests, lint, typecheck**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add Vue Query data layer and app navigation"
```

---

### Task 4: Users, Nodes, Routes, PreAuth Keys read-only pages

**Files:**
- Create: the feature pages and drawers listed above
- Test: the four page component specs

Page rules:

- Users: table with client search + provider filter, detail drawer. No create/rename/delete.
- Nodes: online, name, user, IPs, tags, route counts, register method, last seen, expiry. Search/filter/sort. Detail drawer. Mask `machineKey` / `nodeKey` / `discoKey` to preview; no copy-full-key buttons.
- Routes: derive from `useNodesQuery()`. Table or grouped-by-node view. Show advertised/approved/serving. Filters: pending / approved / exit / subnet. No approve buttons.
- PreAuth Keys: table with filters. Show preview, user, flags, expiry, state. No create/expire/delete.

Empty, loading, and error states are required. Errors use localized messages plus optional API detail.

- [ ] **Step 1: Write failing page tests** for loading/empty/success and one filter each.

- [ ] **Step 2: Implement the pages**

- [ ] **Step 3: Re-run component tests and commit**

```bash
git commit -m "feat: add read-only users, nodes, routes, and preauth pages"
```

---

### Task 5: Dashboard

**Files:**
- Create: `src/features/dashboard/DashboardPage.vue`
- Modify: `src/router/index.ts` to use Dashboard at `/`
- Delete: `src/features/shell/ConnectedHomePage.vue`
- Test: `tests/component/dashboard-page.spec.ts`

Cards from existing queries only: version, database, user count, node total/online/offline, advertised route count, approved route count, active PreAuthKey count, soon-expiring PreAuthKey count (expiration within 7 days).

Lists: recently offline / long-unseen nodes, soon-expiring nodes, soon-expiring keys, nodes with advertised but unapproved routes.

The test must mock Vue Query or repositories so Dashboard does not introduce new HTTP paths beyond version/health/user/node/preauthkey.

- [ ] **Step 1: Write failing Dashboard tests**

- [ ] **Step 2: Implement Dashboard and remove ConnectedHomePage**

- [ ] **Step 3: Run full quality gates**

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm api:check
VITE_BASE_PATH=/admin/ pnpm build
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add dashboard from shared Headscale queries"
```

## Phase 2 Done When

- Connected users can browse Dashboard, Users, Nodes, Routes, and PreAuth Keys.
- Manual refresh and configurable polling update all lists.
- No write buttons exist.
- No extra API calls on Dashboard.
- IDs remain strings and keys stay masked.
- Quality gates pass.

## Out of Scope

User/node/key mutations, route approval, Settings page, Docker docs, Playwright e2e.
