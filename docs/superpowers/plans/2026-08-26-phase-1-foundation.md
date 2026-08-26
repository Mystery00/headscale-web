# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a buildable Vue 3 SPA that can connect to a Headscale 0.29.x instance, persist credentials safely, and block unsupported versions.

**Architecture:** Static Vite SPA. Pages talk only to repositories. Repositories use a generated OpenAPI client plus a small raw `/version` helper. Pinia holds client settings only. API keys live in a memory `CredentialStore` backed by `sessionStorage` or `localStorage`. Vue Query is installed now so later phases can attach server caches without changing the app shell.

**Tech Stack:** Vue 3, Vite, TypeScript, Vue Router, Pinia, Naive UI, TanStack Vue Query, Vue I18n, `openapi-typescript`, `openapi-fetch`, `swagger2openapi`, Zod, Vitest, Vue Testing Library, MSW, pnpm, Node.js 22 LTS.

**Spec:** [docs/design.md](../../design.md)

## Global Constraints

- Product name is `Headscale Web`; repo, npm package, and image name are `headscale-web`.
- Browser title is `Headscale Web`. Storage key prefix is `hs-web:v1:`.
- Target Headscale `0.29.x` only. Reject 0.26–0.28 and 0.30+.
- Static SPA only: no backend, BFF, database, or server session.
- Business components must not call `fetch`, concatenate API URLs, or set Bearer headers.
- Generated OpenAPI types may appear only in `src/api/generated`, client, repositories, and mappers.
- All uint64 IDs stay strings.
- API keys must never enter URLs, error objects, `console`, logs, or query keys.
- UI copy uses Vue I18n (`zh-CN`, `en-US`). No hardcoded user-facing Chinese or English in components.
- Connection copy uses “Connect” / “Disconnect”, never “Log in” / “Log out”.
- `VITE_BASE_PATH` must start and end with `/`.
- Do not add ACL, API Key management, multi-instance, SSO, or a backend.
- Pin the OpenAPI contract to Headscale `v0.29.3`. Do not generate from Headscale `main`.
- TypeScript strict mode. No `any` outside generated code.
- Do not introduce Axios.

## File Map

Create these files. No later task should invent a different path or export name.

```text
package.json
pnpm-lock.yaml
index.html
vite.config.ts
vitest.config.ts
tsconfig.json
tsconfig.app.json
tsconfig.node.json
tsconfig.vitest.json
eslint.config.js
.prettierrc.json
.gitignore
.env.example
public/favicon.svg
scripts/fetch-headscale-swagger.mjs
specs/headscale.swagger.json
specs/headscale.openapi.json
src/main.ts
src/App.vue
src/vite-env.d.ts
src/api/generated/headscale.ts
src/api/errors.ts
src/api/http.ts
src/api/version.ts
src/domain/storage-keys.ts
src/domain/url.ts
src/domain/version.ts
src/domain/system.ts
src/domain/credentials.ts
src/repositories/system-repository.ts
src/stores/settings.ts
src/stores/credentials.ts
src/i18n/index.ts
src/i18n/locales/en-US.ts
src/i18n/locales/zh-CN.ts
src/router/index.ts
src/router/guards.ts
src/features/connection/connection-schema.ts
src/features/connection/ConnectionPage.vue
src/features/shell/AppShell.vue
src/features/shell/ConnectedHomePage.vue
src/styles/reset.css
tests/setup.ts
tests/unit/url.spec.ts
tests/unit/version.spec.ts
tests/unit/errors.spec.ts
tests/unit/credentials.spec.ts
tests/unit/settings.spec.ts
tests/unit/system-repository.spec.ts
tests/component/connection-page.spec.ts
tests/msw/server.ts
tests/msw/handlers.ts
```

---

### Task 1: Scaffold the Vue toolchain

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.vitest.json`, `eslint.config.js`, `.prettierrc.json`, `.gitignore`, `.env.example`, `index.html`, `src/main.ts`, `src/App.vue`, `src/vite-env.d.ts`, `src/styles/reset.css`, `public/favicon.svg`, `tests/setup.ts`
- Test: `tests/unit/scaffold.spec.ts` (delete after Task 2 if unused; keep only if it still asserts `VITE_BASE_PATH` normalization)

**Interfaces:**
- Consumes: Node.js 22, pnpm
- Produces: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` all exist and pass on an empty app

- [ ] **Step 1: Confirm Node 22 and create the Vite app in the existing repo**

The repo already has `README.md` and `docs/`. Do not create a nested directory. From `D:\WebstormProjects\headscale-web`:

```bash
node -v
pnpm -v
```

Expected: Node `v22.x`. If pnpm is missing: `corepack enable && corepack prepare pnpm@latest --activate`.

Initialize without overwriting docs:

```bash
pnpm create vite . --template vue-ts
```

If the tool refuses a non-empty directory, create files manually with the same Vite 6 / Vue 3 `vue-ts` layout. Package name must be `headscale-web`.

- [ ] **Step 2: Add runtime and quality dependencies**

```bash
pnpm add vue-router@4 pinia naive-ui @tanstack/vue-query vue-i18n@11 openapi-fetch zod @vueuse/core lucide-vue-next date-fns
pnpm add -D vue-tsc eslint prettier eslint-plugin-vue typescript-eslint @vue/eslint-config-typescript @vue/eslint-config-prettier vitest @vue/test-utils @testing-library/vue jsdom msw swagger2openapi openapi-typescript @types/node
```

Do not add Axios. Do not add Playwright in this phase.

- [ ] **Step 3: Replace scripts and Vite base handling**

`package.json` scripts:

```json
{
  "name": "headscale-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "vue-tsc -b --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "api:fetch": "node scripts/fetch-headscale-swagger.mjs",
    "api:convert": "swagger2openapi --outfile specs/headscale.openapi.json specs/headscale.swagger.json",
    "api:generate": "openapi-typescript specs/headscale.openapi.json -o src/api/generated/headscale.ts",
    "api:check": "pnpm api:convert && pnpm api:generate && git diff --exit-code -- specs/headscale.openapi.json src/api/generated/headscale.ts"
  }
}
```

`vite.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

function normalizeBasePath(value: string): string {
  if (!value.startsWith('/') || !value.endsWith('/')) {
    throw new Error('VITE_BASE_PATH must start and end with /')
  }
  return value
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: normalizeBasePath(env.VITE_BASE_PATH || '/'),
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
```

`.env.example`:

```text
VITE_BASE_PATH=/
```

`vitest.config.ts` must use `jsdom`, include `tests/**/*.{spec,test}.ts`, and load `tests/setup.ts`.

- [ ] **Step 4: Write a failing base-path unit test**

Create `tests/unit/url.spec.ts` only if URL helpers already exist; otherwise create `tests/unit/base-path.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeBasePath } from '@/domain/url'

describe('normalizeBasePath', () => {
  it('accepts / and /admin/', () => {
    expect(normalizeBasePath('/')).toBe('/')
    expect(normalizeBasePath('/admin/')).toBe('/admin/')
  })

  it('rejects missing slashes', () => {
    expect(() => normalizeBasePath('admin')).toThrow(/start and end with \//)
    expect(() => normalizeBasePath('/admin')).toThrow(/start and end with \//)
  })
})
```

- [ ] **Step 5: Run the test and confirm it fails**

```bash
pnpm test
```

Expected: FAIL because `@/domain/url` does not exist.

- [ ] **Step 6: Add the smallest URL module needed for the scaffold test**

Create `src/domain/url.ts` with `normalizeBasePath` first. Full Headscale URL rules land in Task 3; keep this function exported from the same file.

```ts
export function normalizeBasePath(value: string): string {
  if (!value.startsWith('/') || !value.endsWith('/')) {
    throw new Error('VITE_BASE_PATH must start and end with /')
  }
  return value
}
```

- [ ] **Step 7: Make quality gates pass**

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Expected: all pass. `VITE_BASE_PATH=/admin/ pnpm build` must also pass.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml index.html vite.config.ts vitest.config.ts tsconfig*.json eslint.config.js .prettierrc.json .gitignore .env.example src tests public
git commit -m "chore: scaffold Vue 3 Vite TypeScript app"
```

---

### Task 2: Pin the Headscale 0.29.3 contract

**Files:**
- Create: `scripts/fetch-headscale-swagger.mjs`, `specs/headscale.swagger.json`, `specs/headscale.openapi.json`, `src/api/generated/headscale.ts`
- Modify: `package.json` (scripts already added in Task 1)

**Interfaces:**
- Consumes: Headscale tag `v0.29.3` only
- Produces: committed Swagger 2, OpenAPI 3, and `openapi-typescript` types; `pnpm api:check` is deterministic

- [ ] **Step 1: Write the fetch script with a pinned URL**

`scripts/fetch-headscale-swagger.mjs`:

```js
import { writeFile } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'

const SOURCE =
  'https://raw.githubusercontent.com/juanfont/headscale/v0.29.3/gen/openapiv2/headscale/v1/headscale.swagger.json'

const response = await fetch(SOURCE)
if (!response.ok) {
  throw new Error(`Failed to download swagger: ${response.status}`)
}

await mkdir('specs', { recursive: true })
await writeFile('specs/headscale.swagger.json', await response.text(), 'utf8')
```

Do not accept a branch name, `main`, or a floating tag.

- [ ] **Step 2: Download, convert, and generate**

```bash
pnpm api:fetch
pnpm api:convert
pnpm api:generate
```

Expected: three files exist. Generated types include `/api/v1/user`, `/api/v1/health`, `/api/v1/node`, `/api/v1/preauthkey`. `/version` is **not** in the spec; that is expected.

- [ ] **Step 3: Run api:check**

```bash
pnpm api:check
```

Expected: PASS with a clean diff. If `openapi-typescript` reformats on second run, rerun generate once and commit the stable output.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-headscale-swagger.mjs specs src/api/generated/headscale.ts
git commit -m "chore: vendor Headscale v0.29.3 OpenAPI contract"
```

---

### Task 3: Headscale URL normalization

**Files:**
- Modify: `src/domain/url.ts`
- Test: `tests/unit/url.spec.ts`

**Interfaces:**
- Consumes: raw user input string
- Produces:

```ts
export type HeadscaleUrlError =
  | 'empty'
  | 'invalid'
  | 'unsupported-protocol'
  | 'credentials-not-allowed'

export type HeadscaleUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: HeadscaleUrlError }

export function normalizeHeadscaleUrl(input: string): HeadscaleUrlResult
export function normalizeBasePath(value: string): string
```

- [ ] **Step 1: Write the failing tests**

Replace/extend `tests/unit/url.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeHeadscaleUrl } from '@/domain/url'

describe('normalizeHeadscaleUrl', () => {
  it('trims and strips a trailing slash', () => {
    expect(normalizeHeadscaleUrl(' https://hs.example.com/ ')).toEqual({
      ok: true,
      url: 'https://hs.example.com',
    })
  })

  it('keeps http and https', () => {
    expect(normalizeHeadscaleUrl('http://127.0.0.1:8080')).toEqual({
      ok: true,
      url: 'http://127.0.0.1:8080',
    })
  })

  it('rejects empty input', () => {
    expect(normalizeHeadscaleUrl('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects non-http protocols', () => {
    expect(normalizeHeadscaleUrl('ftp://hs.example.com')).toEqual({
      ok: false,
      reason: 'unsupported-protocol',
    })
  })

  it('rejects embedded credentials', () => {
    expect(normalizeHeadscaleUrl('https://user:pass@hs.example.com')).toEqual({
      ok: false,
      reason: 'credentials-not-allowed',
    })
  })

  it('rejects unparseable values', () => {
    expect(normalizeHeadscaleUrl('not a url')).toEqual({ ok: false, reason: 'invalid' })
  })
})
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm test -- tests/unit/url.spec.ts
```

Expected: FAIL with `normalizeHeadscaleUrl is not a function` or similar.

- [ ] **Step 3: Implement `normalizeHeadscaleUrl`**

```ts
export type HeadscaleUrlError =
  | 'empty'
  | 'invalid'
  | 'unsupported-protocol'
  | 'credentials-not-allowed'

export type HeadscaleUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: HeadscaleUrlError }

export function normalizeHeadscaleUrl(input: string): HeadscaleUrlResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported-protocol' }
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'credentials-not-allowed' }
  }

  const url = parsed.href.replace(/\/+$/, '')
  return { ok: true, url }
}
```

- [ ] **Step 4: Re-run tests**

```bash
pnpm test -- tests/unit/url.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/url.ts tests/unit/url.spec.ts
git commit -m "feat: normalize and validate Headscale URLs"
```

---

### Task 4: Version gate and error model

**Files:**
- Create: `src/domain/version.ts`, `src/api/errors.ts`
- Test: `tests/unit/version.spec.ts`, `tests/unit/errors.spec.ts`

**Interfaces:**
- Consumes: version strings and `Response`-like HTTP failures
- Produces:

```ts
export function isSupportedHeadscaleVersion(version: string): boolean

export type AppApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'server'
  | 'cors'
  | 'unsupported-version'
  | 'unknown'

export class AppApiError extends Error {
  readonly kind: AppApiErrorKind
  readonly status?: number
  readonly code?: string | number
  readonly details?: unknown
  constructor(input: {
    kind: AppApiErrorKind
    message: string
    status?: number
    code?: string | number
    details?: unknown
    cause?: unknown
  })
}

export function mapHttpFailure(input: {
  status?: number
  body?: unknown
  networkError?: unknown
  timedOut?: boolean
  cors?: boolean
}): AppApiError
```

`AppApiError` must not accept or store an API key. `message` is a safe, already-localized or mapper-owned string. Raw gRPC `message` may be placed in `details`, never concatenated with secrets.

- [ ] **Step 1: Write failing version tests**

```ts
import { describe, expect, it } from 'vitest'
import { isSupportedHeadscaleVersion } from '@/domain/version'

describe('isSupportedHeadscaleVersion', () => {
  it.each(['0.29.0', '0.29.3', 'v0.29.3', '0.29'])(
    'accepts %s',
    (value) => {
      expect(isSupportedHeadscaleVersion(value)).toBe(true)
    },
  )

  it.each(['0.28.0', '0.30.0', '1.0.0', '', 'unknown'])(
    'rejects %s',
    (value) => {
      expect(isSupportedHeadscaleVersion(value)).toBe(false)
    },
  )
})
```

- [ ] **Step 2: Write failing error-mapping tests**

```ts
import { describe, expect, it } from 'vitest'
import { mapHttpFailure } from '@/api/errors'

describe('mapHttpFailure', () => {
  it('maps 401 to unauthorized', () => {
    const error = mapHttpFailure({ status: 401, body: { code: 16, message: 'unauthenticated' } })
    expect(error.kind).toBe('unauthorized')
    expect(error.status).toBe(401)
    expect(error.details).toEqual({ code: 16, message: 'unauthenticated' })
  })

  it('maps 404/409/400/5xx', () => {
    expect(mapHttpFailure({ status: 404 }).kind).toBe('not-found')
    expect(mapHttpFailure({ status: 409 }).kind).toBe('conflict')
    expect(mapHttpFailure({ status: 400 }).kind).toBe('validation')
    expect(mapHttpFailure({ status: 500 }).kind).toBe('server')
  })

  it('maps timeout, cors, and network', () => {
    expect(mapHttpFailure({ timedOut: true }).kind).toBe('timeout')
    expect(mapHttpFailure({ cors: true }).kind).toBe('cors')
    expect(mapHttpFailure({ networkError: new TypeError('Failed to fetch') }).kind).toBe('network')
  })
})
```

- [ ] **Step 3: Run tests and confirm they fail**

```bash
pnpm test -- tests/unit/version.spec.ts tests/unit/errors.spec.ts
```

Expected: FAIL because modules are missing.

- [ ] **Step 4: Implement version parsing**

Accept optional leading `v`. Parse `major.minor` and require `major === 0 && minor === 29`. Ignore patch and any `+build` / `-prerelease` suffix after the patch number only if the numeric core is still 0.29.x. `'0.29'` counts as 0.29.0.

- [ ] **Step 5: Implement `AppApiError` and `mapHttpFailure`**

Classification order:

1. `timedOut` → `timeout`
2. `cors` → `cors`
3. `networkError` without status → `network`
4. HTTP status: 401, 403, 404, 409, 400/422 → matching kinds; 500–599 → `server`
5. else → `unknown`

If `body` is a gRPC gateway object `{ code, message, details }`, copy those fields onto the error. Never JSON.stringify the whole request. Never include headers.

- [ ] **Step 6: Re-run tests**

```bash
pnpm test -- tests/unit/version.spec.ts tests/unit/errors.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/version.ts src/api/errors.ts tests/unit/version.spec.ts tests/unit/errors.spec.ts
git commit -m "feat: add version gate and AppApiError mapping"
```

---

### Task 5: CredentialStore

**Files:**
- Create: `src/domain/storage-keys.ts`, `src/domain/credentials.ts`, `src/stores/credentials.ts`
- Test: `tests/unit/credentials.spec.ts`

**Interfaces:**
- Consumes: `sessionStorage` / `localStorage`
- Produces:

```ts
export const STORAGE_KEYS = {
  settings: 'hs-web:v1:settings',
  apiKeySession: 'hs-web:v1:api-key:session',
  apiKeyLocal: 'hs-web:v1:api-key:local',
  locale: 'hs-web:v1:locale',
  theme: 'hs-web:v1:theme',
} as const

export type CredentialPersistence = 'session' | 'local'

export interface CredentialStore {
  hydrate(): void
  getApiKey(): string | null
  setApiKey(key: string, persistence: CredentialPersistence): void
  clear(): void
}

export function createCredentialStore(input?: {
  sessionStorage?: Storage
  localStorage?: Storage
}): CredentialStore
```

Runtime reads come only from memory after `hydrate()`. Default persistence is `session`. `setApiKey(..., 'local')` writes local and removes the session key. `setApiKey(..., 'session')` writes session and removes the local key. `clear()` wipes memory and both storage keys.

- [ ] **Step 1: Write failing tests with in-memory Storage doubles**

Cover:

- hydrate from session
- hydrate from local when session is empty
- session wins if both exist
- switching persistence moves the key and deletes the other
- clear removes both
- `getApiKey()` after `setApiKey` does not re-read storage
- stored values are raw key strings, never JSON objects that dump into logs

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm test -- tests/unit/credentials.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the store**

Do not encrypt. Do not log the key. Trim input; reject empty keys with a thrown `Error('API key must not be empty')` — this exception message is for developers, not UI.

- [ ] **Step 4: Re-run tests**

```bash
pnpm test -- tests/unit/credentials.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/storage-keys.ts src/domain/credentials.ts src/stores/credentials.ts tests/unit/credentials.spec.ts
git commit -m "feat: add API key credential store"
```

---

### Task 6: Settings store

**Files:**
- Create: `src/stores/settings.ts`
- Test: `tests/unit/settings.spec.ts`

**Interfaces:**
- Consumes: `STORAGE_KEYS.settings`, `STORAGE_KEYS.locale`, `STORAGE_KEYS.theme`
- Produces: Pinia store `useSettingsStore`

```ts
export type ThemePreference = 'light' | 'dark' | 'system'
export type LocaleCode = 'zh-CN' | 'en-US'
export type DateTimeStyle = 'absolute' | 'relative'

export interface AppSettings {
  baseUrl: string | null
  credentialPersistence: CredentialPersistence
  pollingEnabled: boolean
  pollingIntervalMs: number
  locale: LocaleCode
  theme: ThemePreference
  dateTimeStyle: DateTimeStyle
}

export const POLLING_INTERVAL_PRESETS_MS: readonly number[]
export const DEFAULT_POLLING_INTERVAL_MS = 15_000
export const MIN_POLLING_INTERVAL_MS = 5_000
```

Defaults: `baseUrl: null`, `credentialPersistence: 'session'`, `pollingEnabled: true`, `pollingIntervalMs: 15000`, `locale` from `localStorage` else browser language (`zh*` → `zh-CN`, else `en-US`), `theme: 'system'`, `dateTimeStyle: 'absolute'`.

This store must not hold users, nodes, or API keys.

- [ ] **Step 1: Write failing tests**

Use `createPinia()` plus a storage double. Assert persist/restore, polling interval clamp to `>= 5000`, and that unknown locale/theme values fall back to defaults.

- [ ] **Step 2: Run tests and confirm they fail**

```bash
pnpm test -- tests/unit/settings.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the Pinia store**

Persist settings JSON to `hs-web:v1:settings`. Persist locale and theme also to their dedicated keys from the spec.

- [ ] **Step 4: Re-run tests**

```bash
pnpm test -- tests/unit/settings.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/settings.ts tests/unit/settings.spec.ts
git commit -m "feat: add client settings store"
```

---

### Task 7: HTTP client and System repository

**Files:**
- Create: `src/api/http.ts`, `src/api/version.ts`, `src/domain/system.ts`, `src/repositories/system-repository.ts`, `tests/msw/server.ts`, `tests/msw/handlers.ts`
- Test: `tests/unit/system-repository.spec.ts`

**Interfaces:**
- Consumes: `normalizeHeadscaleUrl`, `CredentialStore.getApiKey()`, generated `paths`, `mapHttpFailure`, `isSupportedHeadscaleVersion`
- Produces:

```ts
export interface VersionInfo {
  version: string
  commit?: string
}

export interface HealthInfo {
  databaseConnectivity: boolean
}

export interface SystemStatus {
  version: string
  commit?: string
  databaseConnectivity: boolean
  apiReachable: boolean
  checkedAt: Date
}

export interface HeadscaleHttp {
  request(input: {
    path: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    query?: Record<string, string>
    body?: unknown
    authenticated: boolean
  }): Promise<unknown>
}

export function createHeadscaleHttp(input: {
  getBaseUrl: () => string
  getApiKey: () => string | null
  fetch?: typeof fetch
  timeoutMs?: number
}): HeadscaleHttp

export interface SystemRepository {
  getVersion(): Promise<VersionInfo>
  getHealth(): Promise<HealthInfo>
  validateConnection(): Promise<SystemStatus>
}

export function createSystemRepository(http: HeadscaleHttp): SystemRepository
```

HTTP rules:

- Default timeout 15s via `AbortSignal.timeout` or equivalent.
- Authenticated requests send `Authorization: Bearer <key>` and `Accept: application/json`.
- `/version` is unauthenticated.
- GET network failures retry once. Writes never retry.
- Encode path/query with `URL` / `URLSearchParams`. No string concatenation of unsanitized segments.
- If `getApiKey()` is null on an authenticated call, throw `AppApiError` kind `unauthorized`.
- Never put the key on `AppApiError`.

`validateConnection()` order:

1. `GET {baseUrl}/version`
2. if not 0.29.x → throw `AppApiError` kind `unsupported-version`
3. `GET {baseUrl}/api/v1/health`
4. `GET {baseUrl}/api/v1/user`
5. return `SystemStatus` with `apiReachable: true` and `checkedAt: now`

- [ ] **Step 1: Write MSW handlers**

`tests/msw/handlers.ts` should serve:

- `GET /version` → `{ version: "0.29.3", commit: "abc" }`
- `GET /api/v1/health` → `{ databaseConnectivity: true }`
- `GET /api/v1/user` → `{ users: [] }`

Include variants in the spec tests by overriding handlers per case.

- [ ] **Step 2: Write failing repository tests**

Required cases:

- success path calls version → health → user in that order
- non-0.29 version never calls health or user
- 401 on user maps to `unauthorized`
- GET `/version` sends no Authorization header
- health and user send `Authorization: Bearer test-key`
- timeout maps to `timeout`
- a GET network error is retried once
- a failed POST (add a tiny test helper request) is not retried
- error objects / test logs do not contain `test-key` except in the Authorization assertion

- [ ] **Step 3: Run tests and confirm they fail**

```bash
pnpm test -- tests/unit/system-repository.spec.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement HTTP + repository**

Use `openapi-fetch` for `/api/v1/*` if the generated client fits cleanly; keep `/version` as a dedicated helper in `src/api/version.ts`. If wiring `openapi-fetch` middleware is larger than this task, a thin typed wrapper around `fetch` is acceptable **only if** it still uses generated `paths` for API route literals and does not hand-roll response types for `/api/v1/health` and `/api/v1/user`.

- [ ] **Step 5: Re-run tests**

```bash
pnpm test -- tests/unit/system-repository.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/api/http.ts src/api/version.ts src/domain/system.ts src/repositories tests/msw tests/unit/system-repository.spec.ts
git commit -m "feat: add Headscale HTTP client and system repository"
```

---

### Task 8: App shell, i18n, router, and connection page

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/locales/en-US.ts`, `src/i18n/locales/zh-CN.ts`, `src/router/index.ts`, `src/router/guards.ts`, `src/features/connection/connection-schema.ts`, `src/features/connection/ConnectionPage.vue`, `src/features/shell/AppShell.vue`, `src/features/shell/ConnectedHomePage.vue`
- Modify: `src/main.ts`, `src/App.vue`, `index.html`
- Test: `tests/component/connection-page.spec.ts`

**Interfaces:**
- Consumes: `normalizeHeadscaleUrl`, `createCredentialStore`, `useSettingsStore`, `createSystemRepository`, `AppApiError`
- Produces:

Routes:

```ts
/connect          → ConnectionPage
/                 → ConnectedHomePage inside AppShell
```

Guard: if `credentialStore.getApiKey()` is null or `settings.baseUrl` is null, redirect to `/connect`. After a successful connect, persist settings + key and route to `/`. Disconnect clears credentials and both storages, then routes to `/connect`.

Router:

```ts
createWebHistory(import.meta.env.BASE_URL)
```

Connection form Zod schema lives in `connection-schema.ts` and reuses `normalizeHeadscaleUrl`. Persistence `'local'` requires an explicit risk-confirmation checkbox before submit is enabled.

Connection test steps shown in order: network → version → database → authorization. Map failures:

- network/cors/timeout → fail network step
- unsupported-version → fail version step
- health failure → fail database step
- 401/403 → fail authorization step

`ConnectedHomePage` is a temporary Phase 1 landing page that shows version, database connectivity, and a Disconnect button. Do not build Dashboard cards yet.

`index.html` title: `Headscale Web`.

- [ ] **Step 1: Add locale dictionaries with real keys**

Minimum keys:

```ts
{
  app: { title: 'Headscale Web' },
  connection: {
    title,
    urlLabel,
    apiKeyLabel,
    showApiKey,
    hideApiKey,
    persistenceSession,
    persistenceLocal,
    localRisk,
    localRiskConfirm,
    connect,
    connecting,
    steps: { network, version, database, authorization },
    errors: {
      empty,
      invalid,
      unsupportedProtocol,
      credentialsNotAllowed,
      network,
      timeout,
      cors,
      unsupportedVersion,
      unauthorized,
      unknown,
    },
  },
  shell: { disconnect, version, databaseConnected, databaseDisconnected },
}
```

English and Chinese must both exist. Components only use `t('...')`.

- [ ] **Step 2: Write failing component tests**

Use Vue Testing Library + Naive UI + Pinia + vue-i18n + vue-router + MSW.

Cases:

1. Renders URL and API key fields.
2. Successful connect stores the key in sessionStorage by default and navigates to `/`.
3. Local persistence stays disabled until the risk checkbox is checked; then the key is in localStorage only.
4. Version `0.28.0` shows the unsupported-version message and does not store the key.
5. 401 shows authorization failure and does not navigate.
6. No hardcoded English/Chinese string literals in `ConnectionPage.vue` besides i18n key names.

- [ ] **Step 3: Run tests and confirm they fail**

```bash
pnpm test -- tests/component/connection-page.spec.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement main.ts wiring**

Create Pinia, Vue Query client, i18n, Naive UI, router. Hydrate credentials before installing the guard. Provide a single `CredentialStore` instance through a small `src/stores/credentials.ts` export (`credentialStore`) so guards and pages share memory.

- [ ] **Step 5: Implement Connection page and shell**

Naive UI form. Password input with show/hide. Step list. Disable submit while the request is in flight. On success, `settings.baseUrl = normalizedUrl`, `settings.credentialPersistence = selected`, `credentialStore.setApiKey(key, persistence)`, then `router.push('/')`.

- [ ] **Step 6: Re-run component tests and quality gates**

```bash
pnpm test -- tests/component/connection-page.spec.ts
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
VITE_BASE_PATH=/admin/ pnpm build
pnpm api:check
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts src/App.vue src/i18n src/router src/features index.html tests/component
git commit -m "feat: add connection page and auth guard"
```

---

## Phase 1 Done When

- A user can open `/connect`, enter a Headscale URL and API key, and see network / version / database / authorization steps.
- Non-0.29.x is rejected before entering the app.
- API key defaults to `sessionStorage` and can be stored in `localStorage` only after risk confirmation.
- Refreshing a protected route without credentials returns to `/connect`.
- Disconnect clears memory, session, and local keys.
- No component calls `fetch` directly.
- `pnpm lint`, `format:check`, `typecheck`, `test`, `build`, and `api:check` pass.
- Root and `/admin/` builds both succeed.

## Out of Scope For This Plan

Dashboard cards, Users/Nodes/Routes/PreAuth Keys CRUD, Settings page, Docker/Caddy/Nginx docs, Playwright e2e, and live `headscale/headscale:0.29.3` contract tests belong to later phase plans.

## Spec Coverage

| Spec section | Task |
|---|---|
| 2, 5, 6 toolchain and layout | 1 |
| 7 OpenAPI pin | 2 |
| 8 URL rules / 19 base path | 1, 3 |
| 9 errors | 4 |
| 4.1 / 10 credentials and settings | 5, 6 |
| 8 HTTP / 12 SystemRepository / 13 version+health+user | 7 |
| 14.2 connection UI / 17 i18n / 19 router | 8 |
| 18 key leakage rules | 5, 7, 8 |
| 23 quality gates except e2e | 8 |
| 24 Phase 1 bullets | 1–8 |

## Self-Review

- No TBD/TODO placeholders remain.
- Names are consistent: `CredentialPersistence`, `AppApiError`, `createSystemRepository`, `normalizeHeadscaleUrl`, `STORAGE_KEYS`.
- `/version` is intentionally outside generated paths.
- Phase 2 pages are not implemented here.
