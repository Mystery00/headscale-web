# Phase 4 Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a Settings page, deploy artifacts/docs, accessibility basics, and a Playwright smoke suite against a mock Headscale 0.29 server.

**Architecture:** Settings writes only Pinia client state and CredentialStore. 401 is handled in the Query cache: clear queries and route to `/connect` without deleting a long-lived key. Docker is a multi-stage static image. E2E talks to Vite preview plus a local mock `/version` and `/api/v1` server.

**Tech Stack:** Existing app plus Playwright, Docker (nginx), Caddyfile, deploy docs.

**Spec:** [docs/design.md](../../design.md) sections 14.8, 18–23, 24 Phase 4.

## Global Constraints

- Settings must not store users/nodes in Pinia.
- Polling interval presets 5/10/15/30/60s, min 5s, default 15s.
- `VITE_BASE_PATH` is build-time only.
- Production HTTPS; no `connect-src *` as the recommended CSP.
- CORS docs must cover `/version` and `/api/v1/*`.
- Playwright is required for `pnpm test:e2e`; unit `pnpm test` stays mock/MSW.

## Tasks

### Task 1: Settings, datetime, 401, a11y CSS

Files: `src/features/settings/SettingsPage.vue`, `src/domain/datetime.ts`, `src/query/client.ts`, `src/router/index.ts`, `src/features/shell/AppNav.vue`, `src/styles/reset.css`, locales, `tests/unit/datetime.spec.ts`, `tests/component/settings-page.spec.ts`.

- Date helper: absolute via `date-fns/format`, relative via `formatDistanceToNow`, locale from settings.
- Settings: URL, API key update, persistence + risk confirm, polling switch + interval, locale, theme, dateTimeStyle, test connection, disconnect.
- Query cache `onError`: `AppApiError.kind === 'unauthorized'` → `queryClient.clear()` + `router.push('/connect')`. Do not call `credentialStore.clear()` automatically.
- `prefers-reduced-motion: reduce` disables transitions.

### Task 2: Deploy artifacts

Files: `Dockerfile`, `Caddyfile`, `deploy/nginx.conf`, `docs/deploy.md`, `public/healthz`, README.

- Multi-stage: Node 22 + pnpm build, nginx unprivileged, `/healthz`, `VITE_BASE_PATH` ARG default `/`.
- Document same-origin `/admin/` and independent-origin CORS for `/version` and `/api/v1/*`.

### Task 3: Playwright smoke

Files: `playwright.config.ts`, `tests/e2e/mock-headscale.mjs`, `tests/e2e/connect.spec.ts`, package script `test:e2e`.

Cover: successful connect, reject 0.28.x, create user, 401 returns to `/connect`.

## Done When

Settings works, deploy docs exist, Docker builds statically, reduced-motion is honored, e2e smoke can run with `pnpm test:e2e`.
