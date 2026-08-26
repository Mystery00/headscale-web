# Admin UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prototype-like authenticated UI with a cohesive, responsive admin console matching the approved connection-page visual language.

**Architecture:** Keep repositories, mappers, Vue Query, mutations, routing, and stores unchanged. Add a small shared presentation layer under `src/components/ui`, rebuild the authenticated shell around those primitives, then migrate each feature page to Naive UI data tables, cards, status badges, drawers, and confirmation dialogs.

**Tech Stack:** Vue 3 Composition API, TypeScript, Naive UI, Lucide Vue, Vue I18n, Vue Testing Library, Vitest, MSW, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-admin-ui-redesign-design.md`

## Global Constraints

- Preserve the current Headscale 0.29.3 API, Repository, Mapper, Query, Mutation, Router, and Pinia boundaries.
- Use the connection page's dark modern console style with teal as the primary accent.
- Shared UI components must not access repositories, queries, mutations, or stores directly.
- No complete API key may appear in UI snapshots, logs, source fixtures, reports, or commits.
- Never validate write operations against the production Headscale instance; use MSW and the local mock server only.
- Every dangerous action must require explicit confirmation before mutation execution.
- Support `zh-CN`, `en-US`, light, dark, system theme, desktop, tablet, and phone layouts.
- Status must never be communicated by color alone.
- Preserve `prefers-reduced-motion` behavior.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and changed-file Prettier checks before completion.

---

### Task 1: Shared Admin UI Primitives

**Files:**
- Create: `src/components/ui/PageHeader.vue`
- Create: `src/components/ui/PageToolbar.vue`
- Create: `src/components/ui/StatCard.vue`
- Create: `src/components/ui/StatusBadge.vue`
- Create: `src/components/ui/AppDataTable.vue`
- Create: `src/components/ui/EmptyState.vue`
- Create: `src/components/ui/ConfirmDialog.vue`
- Create: `src/styles/admin.css`
- Modify: `src/main.ts`
- Modify: `src/i18n/locales/en-US.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Test: `tests/component/ui-primitives.spec.ts`

**Interfaces:**
- Produces: `PageHeader` with `title`, optional `description`, and `actions` slot.
- Produces: `PageToolbar` with default content and `actions` slot.
- Produces: `StatCard` with `label`, `value`, optional `tone`, and default icon slot.
- Produces: `StatusBadge` with `label` and `tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'`.
- Produces: `AppDataTable<T>` forwarding Naive UI `columns`, `data`, `loading`, `rowKey`, and `scrollX`.
- Produces: `EmptyState` with `title`, optional `description`, and `action` slot.
- Produces: `ConfirmDialog` with `show`, `title`, `message`, `confirmLabel`, `confirmText`, `expectedText`, `danger`, and `pending`; emits `update:show` and `confirm`.

- [ ] **Step 1: Write failing primitive component tests**

Create tests that render real components and assert observable contracts:

```ts
it('labels a status with text instead of color alone', () => {
  render(StatusBadge, { props: { label: 'Online', tone: 'success' } })
  expect(screen.getByText('Online')).toBeTruthy()
})

it('blocks typed confirmation until the expected value matches', async () => {
  const view = render(ConfirmDialog, {
    props: {
      show: true,
      title: 'Delete node',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      confirmText: 'Type node-a to confirm',
      expectedText: 'node-a',
      danger: true,
      pending: false,
    },
  })
  expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  await fireEvent.update(screen.getByRole('textbox'), 'node-a')
  await fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(view.emitted().confirm).toHaveLength(1)
})
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `pnpm test tests/component/ui-primitives.spec.ts`

Expected: FAIL because the shared components do not exist.

- [ ] **Step 3: Implement the primitives and admin tokens**

Use focused components. `StatusBadge` must render a dot/icon plus visible text. `ConfirmDialog` must clear typed confirmation whenever it closes. `AppDataTable` must provide a styled empty slot and horizontal overflow without owning business columns.

Define reusable admin variables in `src/styles/admin.css`:

```css
:root {
  --admin-bg: #f2f6f8;
  --admin-surface: #ffffff;
  --admin-surface-muted: #f7fafb;
  --admin-border: #dfe8eb;
  --admin-text: #102235;
  --admin-muted: #66788a;
  --admin-primary: #0f9f78;
  --admin-sidebar: #09251f;
}

.admin-theme-dark {
  --admin-bg: #08111d;
  --admin-surface: #0f1b2a;
  --admin-surface-muted: #132235;
  --admin-border: #25364b;
  --admin-text: #edf5f7;
  --admin-muted: #94a3b8;
  --admin-primary: #35d0a3;
  --admin-sidebar: #071712;
}
```

Import `admin.css` from `src/main.ts` after `reset.css`.

- [ ] **Step 4: Run primitive tests and static checks**

Run:

```bash
pnpm test tests/component/ui-primitives.spec.ts
pnpm typecheck
pnpm lint
```

Expected: PASS with no warnings from project code.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui src/styles/admin.css src/main.ts src/i18n/locales tests/component/ui-primitives.spec.ts
git commit -m "feat: add shared admin UI primitives"
```

---

### Task 2: Authenticated Shell, Navigation, and Status Bar

**Files:**
- Modify: `src/features/shell/AppShell.vue`
- Modify: `src/features/shell/AppNav.vue`
- Modify: `src/features/shell/StatusBar.vue`
- Modify: `src/App.vue`
- Modify: `src/i18n/locales/en-US.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Test: `tests/component/app-shell.spec.ts`

**Interfaces:**
- Consumes: admin CSS variables and `StatusBadge` from Task 1.
- Produces: `.admin-theme-dark` / `.admin-theme-light` class on the authenticated shell based on settings.
- Produces: responsive navigation drawer controlled only by shell-local state.

- [ ] **Step 1: Write failing shell tests**

Test full-height semantics, labelled navigation, current instance status, and mobile menu behavior:

```ts
it('renders a labelled admin navigation and main content region', async () => {
  await renderShell('/')
  expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeTruthy()
  expect(screen.getByRole('main')).toBeTruthy()
})

it('opens the navigation drawer from the mobile menu button', async () => {
  await renderShell('/')
  await fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  expect(screen.getAllByRole('navigation', { name: 'Primary navigation' }).length).toBeGreaterThan(1)
})
```

- [ ] **Step 2: Run shell tests and verify RED**

Run: `pnpm test tests/component/app-shell.spec.ts`

Expected: FAIL because the shell does not expose the approved structure or labels.

- [ ] **Step 3: Rebuild the shell**

Implement:

- root authenticated layout with `min-height: 100vh`;
- fixed 232px desktop sidebar and mobile drawer below 860px;
- branded sidebar header with Server icon and `Headscale Web`;
- Lucide icons for all six navigation entries;
- selected navigation state using current route;
- top bar with instance text, version badge, database badge, refresh, language, theme, and disconnect;
- `main` content region using `.admin-content` and a consistent max width;
- mobile menu button with translated `aria-label`;
- drawer closure after route navigation;
- theme class matching the same dark/system calculation used by the connection page.

- [ ] **Step 4: Run shell tests and regression tests**

Run:

```bash
pnpm test tests/component/app-shell.spec.ts tests/component/dashboard-page.spec.ts
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/shell src/App.vue src/i18n/locales tests/component/app-shell.spec.ts
git commit -m "feat: redesign authenticated app shell"
```

---

### Task 3: Dashboard Overview

**Files:**
- Modify: `src/features/dashboard/DashboardPage.vue`
- Modify: `src/i18n/locales/en-US.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `tests/component/dashboard-page.spec.ts`

**Interfaces:**
- Consumes: `PageHeader`, `StatCard`, `StatusBadge`, `EmptyState`.
- Preserves: existing users, nodes, pre-auth keys, system version, and health queries.

- [ ] **Step 1: Add failing dashboard behavior tests**

Add tests that require metric cards and operational sections without asserting private CSS:

```ts
it('groups operational items under labelled sections', async () => {
  await renderConnected(DashboardPage)
  expect(await screen.findByRole('region', { name: 'Needs attention' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Network overview' })).toBeTruthy()
})
```

Use MSW fixtures to include one offline node and one advertised-unapproved route, then assert their visible names/prefixes.

- [ ] **Step 2: Run dashboard tests and verify RED**

Run: `pnpm test tests/component/dashboard-page.spec.ts`

Expected: FAIL because the labelled operational regions do not exist.

- [ ] **Step 3: Implement the dashboard**

- Render `PageHeader` with localized description.
- Render ten `StatCard` components in a responsive CSS grid.
- Add `Network overview` region for version/database and route status.
- Add `Needs attention` region listing offline nodes, expiring nodes, expiring active keys, and advertised-unapproved routes.
- Derive lists from current query data; do not add requests.
- Use `EmptyState` when no attention items exist.
- Use `StatusBadge` for health and online states.

- [ ] **Step 4: Verify dashboard**

Run:

```bash
pnpm test tests/component/dashboard-page.spec.ts
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/DashboardPage.vue src/i18n/locales tests/component/dashboard-page.spec.ts
git commit -m "feat: redesign dashboard overview"
```

---

### Task 4: Users Management Page

**Files:**
- Modify: `src/features/users/UsersPage.vue`
- Modify: `src/i18n/locales/en-US.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `tests/component/users-page.spec.ts`

**Interfaces:**
- Consumes: `PageHeader`, `PageToolbar`, `AppDataTable`, `StatusBadge`, `ConfirmDialog`, `EmptyState`.
- Preserves: `useUsersQuery`, `useNodesQuery`, and existing user mutations.

- [ ] **Step 1: Write failing user-page tests**

Require semantic table behavior and typed delete confirmation:

```ts
it('shows user data in the shared data table', async () => {
  await renderConnected(UsersPage)
  expect(await screen.findByRole('table', { name: 'Users' })).toBeTruthy()
  expect(screen.getByText('alice')).toBeTruthy()
})

it('does not delete until the confirmation name matches', async () => {
  await openUserDetails('alice')
  await fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeDisabled()
})
```

- [ ] **Step 2: Run user tests and verify RED**

Run: `pnpm test tests/component/users-page.spec.ts`

Expected: FAIL because shared table semantics and confirmation dialog are absent.

- [ ] **Step 3: Rebuild UsersPage**

- Use `PageHeader` with Create action.
- Use `PageToolbar` for search and provider filter.
- Replace native table/button markup with `AppDataTable` and Naive render functions.
- Columns: name/display name, email, provider, created time, actions.
- Open details drawer through a secondary `Details` button.
- Group rename and destructive controls inside drawer sections.
- Route delete through `ConfirmDialog`, showing related node count and requiring exact user name.
- Preserve form input after failed mutations.

- [ ] **Step 4: Verify user page**

Run:

```bash
pnpm test tests/component/users-page.spec.ts
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/users/UsersPage.vue src/i18n/locales tests/component/users-page.spec.ts
git commit -m "feat: redesign users management"
```

---

### Task 5: Nodes Management Page

**Files:**
- Modify: `src/features/nodes/NodesPage.vue`
- Modify: `src/i18n/locales/en-US.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `tests/component/nodes-page.spec.ts`

**Interfaces:**
- Consumes: shared page, table, badge, dialog, and empty components.
- Preserves: current node query, masking, tag normalization, and mutations.

- [ ] **Step 1: Write failing node-page tests**

Add tests for accessible online status, filters, and immediate-expiry confirmation:

```ts
it('renders online state as visible text in the node table', async () => {
  await renderConnected(NodesPage)
  expect(await screen.findByText('Online')).toBeTruthy()
})

it('requires confirmation before expiring a node now', async () => {
  await openNodeDetails('node-a')
  await fireEvent.click(screen.getByRole('button', { name: 'Expire now' }))
  expect(screen.getByRole('dialog', { name: 'Expire node now' })).toBeTruthy()
})
```

- [ ] **Step 2: Run node tests and verify RED**

Run: `pnpm test tests/component/nodes-page.spec.ts`

Expected: FAIL because the confirmation and redesigned table are absent.

- [ ] **Step 3: Rebuild NodesPage**

- Add header description and search/status filters.
- Use `AppDataTable` with columns for status, name, user, IP, tags, routes, last seen, expiry, actions.
- Render IPs and tags as compact stacks/tags.
- Render online/offline and expiry state with `StatusBadge`.
- Group drawer content into overview, keys, tags, expiry, and danger sections.
- Keep keys masked.
- Route immediate expiry and deletion through `ConfirmDialog`; deletion requires exact display name.
- Do not add API calls.

- [ ] **Step 4: Verify node page**

Run:

```bash
pnpm test tests/component/nodes-page.spec.ts
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/nodes/NodesPage.vue src/i18n/locales tests/component/nodes-page.spec.ts
git commit -m "feat: redesign nodes management"
```

---

### Task 6: Routes and PreAuth Keys Pages

**Files:**
- Modify: `src/features/routes/RoutesPage.vue`
- Modify: `src/features/preauth-keys/PreAuthKeysPage.vue`
- Modify: `src/i18n/locales/en-US.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `tests/component/routes-page.spec.ts`
- Modify: `tests/component/preauth-keys-page.spec.ts`

**Interfaces:**
- Consumes: shared page, toolbar, table, badge, confirmation, and empty components.
- Preserves: route derivation, grouped exit-route behavior, node locking, one-time plaintext key handling, and current mutations.

- [ ] **Step 1: Write failing dangerous-action confirmation tests**

Routes:

```ts
it('asks for confirmation before revoking an approved route', async () => {
  await renderConnected(RoutesPage)
  await fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }))
  expect(screen.getByRole('dialog', { name: 'Revoke route' })).toBeTruthy()
})
```

PreAuth Keys:

```ts
it('asks for confirmation before expiring or deleting a key', async () => {
  await renderConnected(PreAuthKeysPage)
  await fireEvent.click((await screen.findAllByRole('button', { name: 'Expire' }))[0])
  expect(screen.getByRole('dialog', { name: 'Expire PreAuth Key' })).toBeTruthy()
})
```

- [ ] **Step 2: Run both page tests and verify RED**

Run:

```bash
pnpm test tests/component/routes-page.spec.ts tests/component/preauth-keys-page.spec.ts
```

Expected: FAIL because mutations are currently direct.

- [ ] **Step 3: Rebuild RoutesPage**

- Use header, toolbar filter, and shared table.
- Render advertised/approved/serving as text badges.
- Keep existing node lock and route derivation.
- Require `ConfirmDialog` before revocation; approval may remain a direct positive action.
- Show route prefix and affected node in confirmation text.

- [ ] **Step 4: Rebuild PreAuthKeysPage**

- Use header, toolbar, and shared table.
- Columns: preview, user, state, expiration, properties, actions.
- Disable expiry for used/expired keys.
- Require confirmation before expire and delete.
- Keep full plaintext only in the existing in-memory modal and clear it on close.
- Style creation and plaintext modals as real cards with grouped fields.

- [ ] **Step 5: Verify both pages**

Run:

```bash
pnpm test tests/component/routes-page.spec.ts tests/component/preauth-keys-page.spec.ts
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/routes/RoutesPage.vue src/features/preauth-keys/PreAuthKeysPage.vue src/i18n/locales tests/component/routes-page.spec.ts tests/component/preauth-keys-page.spec.ts
git commit -m "feat: redesign routes and preauth keys"
```

---

### Task 7: Settings Page and Responsive Product Validation

**Files:**
- Modify: `src/features/settings/SettingsPage.vue`
- Modify: `src/i18n/locales/en-US.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `tests/component/settings-page.spec.ts`
- Modify: `tests/e2e/connect.spec.ts`
- Modify: `playwright.config.ts` only if an additional mobile project is required.

**Interfaces:**
- Consumes: `PageHeader`, `StatusBadge`, `ConfirmDialog`, admin CSS variables.
- Preserves: current settings store behavior and connection-test repository flow.

- [ ] **Step 1: Write failing settings structure tests**

```ts
it('groups settings into connection, refresh, and appearance regions', async () => {
  await renderConnected(SettingsPage)
  expect(screen.getByRole('region', { name: 'Connection' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Refresh' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Appearance' })).toBeTruthy()
})

it('asks for confirmation before disconnecting', async () => {
  await renderConnected(SettingsPage)
  await fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
  expect(screen.getByRole('dialog', { name: 'Disconnect' })).toBeTruthy()
})
```

- [ ] **Step 2: Run settings tests and verify RED**

Run: `pnpm test tests/component/settings-page.spec.ts`

Expected: FAIL because sections and confirmation are absent.

- [ ] **Step 3: Rebuild SettingsPage**

- Render `PageHeader` and three labelled card regions: Connection, Refresh, Appearance.
- Keep API key password input empty unless the user explicitly enters a replacement.
- Keep long-term storage risk acknowledgement.
- Put Test connection and Save in the normal action area.
- Put Disconnect in a separate danger zone and require confirmation.
- Ensure withdrawing long-term risk consent selects session persistence.

- [ ] **Step 4: Add responsive E2E coverage**

Extend the local mock-server E2E flow to assert:

```ts
test('authenticated shell remains usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await connect(page)
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('link', { name: 'Nodes' })).toBeVisible()
})
```

Do not run this against production.

- [ ] **Step 5: Run complete validation**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec prettier --check src tests docs/superpowers/plans/2026-08-26-admin-ui-redesign.md
pnpm test:e2e
```

Expected: all commands pass. Existing Vite chunk-size warning may remain non-blocking.

- [ ] **Step 6: Perform local mock browser visual inspection**

Start only the local mock Headscale and Vite server. Inspect Dashboard, Users, Nodes, Routes, PreAuth Keys, and Settings at desktop and 390px width. Do not use production credentials or production endpoints. Confirm:

- no white page area below authenticated content;
- no native white buttons in dark mode;
- tables scroll or reflow on narrow screens;
- all dangerous actions open confirmation before mutation;
- navigation drawer works on phone width;
- no console errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/settings/SettingsPage.vue src/i18n/locales tests/component/settings-page.spec.ts tests/e2e/connect.spec.ts playwright.config.ts
git commit -m "feat: redesign settings and validate responsive UI"
```

---

### Task 8: Final Integration Review and Documentation Sync

**Files:**
- Modify: `README.md` only if authenticated UI behavior or development instructions changed.
- Modify: `docs/design.md` only when implementation differs from its current UI section.
- Test: all existing test suites.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a clean, reviewed branch with documentation matching implemented behavior.

- [ ] **Step 1: Review spec coverage**

Compare implementation against every section of `docs/superpowers/specs/2026-08-26-admin-ui-redesign-design.md`, especially dangerous confirmations, theme behavior, mobile layout, and production-write prohibition.

- [ ] **Step 2: Run final checks**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
pnpm exec prettier --check .
git diff --check
git status --short
```

Expected: all quality commands pass; tracked working tree is clean after the final commit. If repository-wide Prettier exposes pre-existing unrelated formatting, check every changed file explicitly and document the unrelated baseline.

- [ ] **Step 3: Commit documentation-only adjustments if needed**

```bash
git add README.md docs/design.md
git commit -m "docs: sync admin UI documentation"
```

Skip this commit when no documentation adjustment is required.
