# Headscale URL Origin and API Key Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-fill the connection URL from the browser origin and show read-only API key expiration metadata with a manual replacement guide.

**Architecture:** Keep origin inference and API key parsing as pure domain helpers. Add a read-only repository and Vue Query hook for `/api/v1/apikey`, then render a failure-tolerant Settings status panel without adding create, expire, or delete mutations.

**Tech Stack:** Vue 3, TypeScript, Pinia, TanStack Vue Query, Naive UI, Vue I18n, Vitest, Testing Library, MSW.

**Spec:** `docs/superpowers/specs/2026-08-31-api-key-status-and-origin-design.md`

## Global Constraints

- Support Headscale `0.29.x` using the checked-in `v0.29.3` API contract.
- Never call API key create, expire, or delete endpoints.
- Never display, log, or copy the full current API key.
- Existing saved URL takes precedence over `window.location.origin`.
- The expiring-soon threshold is inclusive at exactly 30 days.
- Metadata failures must not block other Settings functions.
- Preserve session/local credential persistence behavior.
- Add both `en-US` and `zh-CN` user-facing text.

---

### Task 1: Connection URL origin default

**Files:**
- Create: `src/domain/connection-defaults.ts`
- Modify: `src/features/connection/ConnectionPage.vue`
- Create: `tests/unit/connection-defaults.spec.ts`
- Modify: `tests/component/connection-page.spec.ts`

**Interfaces:**
- Produces: `initialHeadscaleUrl(savedBaseUrl: string | null, origin: string): string`

- [ ] Write failing unit tests for saved URL precedence and origin fallback.
- [ ] Run `pnpm vitest run tests/unit/connection-defaults.spec.ts` and confirm failure.
- [ ] Implement `return savedBaseUrl ?? origin` in the pure helper.
- [ ] Initialize ConnectionPage with `initialHeadscaleUrl(settings.baseUrl, window.location.origin)`.
- [ ] Add component assertions for origin fallback and saved URL precedence.
- [ ] Run the unit and connection component tests.
- [ ] Commit with `feat: default Headscale URL from page origin`.

---

### Task 2: API key metadata domain and repository

**Files:**
- Create: `src/domain/api-key-status.ts`
- Create: `src/repositories/api-keys-repository.ts`
- Modify: `src/query/keys.ts`
- Modify: `src/query/repositories.ts`
- Modify: `src/query/use-headscale-queries.ts`
- Create: `tests/unit/api-key-status.spec.ts`
- Create: `tests/unit/api-keys-repository.spec.ts`
- Modify: `tests/unit/query-keys.spec.ts`

**Interfaces:**

```ts
export interface ApiKeyMetadata {
  id: string
  displayPrefix: string
  rawPrefix: string
  expiration: Date | null
  createdAt: Date | null
  lastSeen: Date | null
}
export type ApiKeyExpirationState = 'healthy' | 'expiring-soon' | 'expired' | 'no-expiration'
export function parseApiKeyPrefix(key: string): { rawPrefix: string; displayPrefix: string } | null
export function apiKeyExpirationState(expiration: Date | null, now: Date): ApiKeyExpirationState
export interface ApiKeysRepository { current(fullKey: string): Promise<ApiKeyMetadata | null> }
```

- [ ] Write parser tests for `hskey-api-{12}-{64}` and legacy `{7}.secret`, malformed keys, and absence of secret output.
- [ ] Write status tests for null, expired, exactly 30 days, and more than 30 days.
- [ ] Run `pnpm vitest run tests/unit/api-key-status.spec.ts` and confirm failure.
- [ ] Implement strict parsers and the inclusive 30-day threshold.
- [ ] Write an MSW repository test for one authenticated `GET /api/v1/apikey`, matching, date mapping, string IDs, and unmatched null.
- [ ] Implement the read-only repository with no mutation methods.
- [ ] Add `queryKeys.apiKeyStatus`, register `apiKeys`, and add `useCurrentApiKeyQuery()` with `retry: false` and no polling.
- [ ] Run focused domain, repository, and query-key tests.
- [ ] Commit with `feat: read current API key metadata`.
---

### Task 3: Settings status and replacement guide

**Files:**
- Modify: `src/features/settings/SettingsPage.vue`
- Modify: `src/i18n/locales/en-US.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Modify: `tests/component/settings-page.spec.ts`
- Modify: `tests/component/render-connected.ts`

**Interfaces:**
- Consumes: `useCurrentApiKeyQuery`, `apiKeyExpirationState`, and `ApiKeyMetadata`.
- Produces: localized status card and a non-mutating replacement guide.

- [ ] Add a default `/api/v1/apikey` MSW handler using a current-format test credential and matching masked prefix.
- [ ] Write failing component tests for healthy, exactly-30-day, no-expiration, unmatched/error, and replacement-guide states.
- [ ] Assert the guide reveals `headscale apikeys create --expiration 90d` and `headscale apikeys expire --prefix <rawPrefix>`.
- [ ] Assert no POST or DELETE request is made to `/api/v1/apikey*`.
- [ ] Run `pnpm vitest run tests/component/settings-page.spec.ts` and confirm failure.
- [ ] Add matching `settings.apiKeyStatus` strings in `en-US` and `zh-CN`.
- [ ] Implement a separate status region with loading, unavailable, metadata, healthy, warning, expired, and no-expiration states.
- [ ] Keep the full key in the credential store; do not copy it into a component ref.
- [ ] Show the replacement guide only for expiring-soon and expired states.
- [ ] After successful test/save, invalidate `queryKeys.apiKeyStatus` to identify the active replacement key.
- [ ] Run Settings and Connection component tests.
- [ ] Commit with `feat: show API key expiration guidance`.

---

### Task 4: Documentation and complete validation

**Files:**
- Modify: `README.md`
- Modify: `SECURITY.md`
- Modify: `docs/design.md`
- Modify: `docs/deploy.md` only if origin-default deployment behavior needs clarification.

- [ ] Document origin pre-fill, read-only API key metadata, the 30-day warning, and the manual CLI replacement boundary.
- [ ] State explicitly that the UI does not create or revoke API keys.
- [ ] Search production code to confirm there are no POST/DELETE calls to `/api/v1/apikey` or `/api/v1/apikey/expire`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm format:check`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm api:check`.
- [ ] Review the final diff for credential leakage, untranslated text, generated-file changes, and build artifacts.
- [ ] Commit with `docs: explain API key expiration guidance`.