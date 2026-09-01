# Headscale Web Architecture and Design

Headscale Web is an unofficial community UI for Headscale. It is not affiliated with, maintained by, or endorsed by the Headscale project.

This document describes the architecture and product boundaries of the released application. User-facing setup instructions belong in [`README.md`](../README.md) and [`docs/deploy.md`](deploy.md).

## 1. Product scope

Headscale Web is a static single-page application for day-to-day administration of one Headscale instance. It connects directly from the browser to Headscale's `/version` and `/api/v1/*` endpoints.

The current release line:

- Supports Headscale `0.29.x`.
- Uses the Headscale `v0.29.3` Swagger document as its API contract baseline.
- Provides dashboards and management flows for users, nodes, routes, and pre-authentication keys.
- Supports English and Simplified Chinese.
- Can be served at `/` or under a subpath without rebuilding the static bundle.

The product name is not tied to a Headscale version. Compatibility with a new Headscale API requires an explicit compatibility project, contract update, tests, and release notes.

## 2. Product boundaries

Headscale Web intentionally does not include:

- A backend-for-frontend or API proxy
- A database or server-side session
- Local accounts, SSO, or role-based access control
- Multi-instance management
- Headscale API key management
- ACL or HuJSON editing
- Direct access to the Headscale database or configuration files
- Runtime adaptation across multiple incompatible Headscale API versions

External access controls such as Authelia, Authentik, OAuth2 Proxy, or Cloudflare Access may protect the UI origin. They do not replace the Headscale API key and do not change the browser credential boundary.

## 3. Technology stack

Core application dependencies:

- Vue 3 and the Composition API
- Vite and TypeScript
- Vue Router
- Pinia
- Naive UI
- TanStack Vue Query
- Vue I18n
- `openapi-typescript` and `openapi-fetch`
- Zod for selected runtime boundary validation
- VueUse, Lucide Vue, and date-fns

Development and validation use Node.js 22, pnpm, ESLint, Prettier, Vitest, Vue Testing Library, MSW, Playwright, and `vue-tsc`.

## 4. Architecture

The dependency direction is:

```text
Vue pages and components
        |
Application/query layer
        |
Repository interfaces and implementations
        |
Mappers and contract validation
        |
Generated OpenAPI client and HTTP middleware
        |
Headscale /version and /api/v1/*
```

Components must not construct Headscale URLs, authorization headers, or raw API payloads. Generated protocol types stay behind the client, repository, and mapper layers.

### State ownership

- **TanStack Vue Query** owns Headscale server data, request status, caching, invalidation, and polling.
- **Pinia** owns client settings such as the Headscale URL, credential persistence choice, locale, theme, and refresh interval.
- **Credential store** owns the API key independently from ordinary settings.
- **Component-local state** owns forms, dialogs, filters, and one-time secret displays.

Server resources must not be duplicated into Pinia.

## 5. API contract management

The repository keeps the Headscale Swagger source and generated OpenAPI artifacts under version control:

```text
specs/headscale.swagger.json
specs/headscale.openapi.json
src/api/generated/headscale.ts
```

The update flow is:

```bash
pnpm api:fetch
pnpm api:convert
pnpm api:generate
pnpm api:check
```

Generated changes require review. A version check alone is not sufficient evidence that a new Headscale release is compatible; endpoint behavior, payloads, and error formats must also be verified.

Headscale `uint64` identifiers are represented as strings throughout the application to avoid JavaScript precision loss.

## 6. HTTP client and errors

The HTTP layer reads the normalized base URL and API key from the client stores. Protected requests send:

```http
Authorization: Bearer <api-key>
Accept: application/json
```

API keys must never be placed in URLs, logs, analytics, error reports, or general application state.

The shared error model classifies failures such as network errors, timeouts, unauthorized or forbidden responses, not found, conflicts, validation errors, server errors, CORS failures, unsupported versions, and unknown failures. Raw Headscale or gRPC Gateway details may be displayed as secondary diagnostic information, but primary messages are localized and actionable.

Read-only requests may be retried conservatively after transient network failures. Mutating requests are not retried automatically.

## 7. Connection and credentials

The connection flow validates:

1. The Headscale URL.
2. `GET /version` and the supported `0.29.x` range.
3. Headscale health.
4. API authorization by loading protected data.

Without a usable credential, protected routes redirect to `/connect`.

When no Headscale URL has been saved, the connection form is initialized from `window.location.origin`. A saved URL always takes precedence, and the current page path is never included.

The API key is stored in `sessionStorage` by default. A user may explicitly choose `localStorage` after acknowledging the persistence risk. The application does not claim that client-side storage can hide a credential from the browser. Disconnecting clears in-memory, session, and persistent credential locations managed by the application.

Settings uses the read-only `GET /api/v1/apikey` endpoint to match the active credential by its current or legacy non-secret prefix. It displays healthy, expiring-soon, expired, no-expiration, or unavailable status. The expiring-soon boundary includes exactly 30 days. Metadata failures degrade to unavailable without blocking other settings.

The browser application does not create, rotate, expire, revoke, or delete API keys. For expiring and expired keys it presents manual CLI guidance: create a replacement, validate and save it through the existing connection form, then expire the old prefix only after the replacement works.

## 8. Domain behavior

### Users

Users can be listed, inspected, created, renamed, and deleted. Destructive actions require confirmation and do not simulate server-side cascading behavior.

### Nodes

Nodes expose identity, owner, addresses, online state, registration method, tags, expiry, routes, and selected key metadata. The UI supports renaming, expiry changes, tag updates, and deletion.

Machine, node, and discovery key values are treated as sensitive infrastructure data. The UI avoids encouraging unnecessary copying of full values.

### Routes

Headscale `0.29.x` does not expose a separate route-list resource for this UI. Route views are derived from node data:

- `availableRoutes` indicates advertised routes.
- `approvedRoutes` indicates administrator approval.
- `subnetRoutes` indicates routes currently being served.
- `0.0.0.0/0` and `::/0` are treated as exit routes.

Route updates send the complete new approved-route set for a node, not an incremental fragment. This avoids accidentally replacing unrelated approved routes.

### Node authentication approval

The flat `/register?authId=...` and `/auth?authId=...` routes complete short-lived Headscale authentication requests through the authenticated `/api/v1/auth/*` endpoints. A front proxy redirects Headscale's nested URLs to these SPA routes. Auth IDs are validated, masked, kept out of storage, and removed from the URL after a terminal action.

### Pre-authentication keys

Pre-authentication keys can be listed, created, expired, and deleted. A newly created full key is held only in the success dialog's local memory and is removed when that flow closes. It must not be written to Pinia, Vue Query cache, browser settings, or logs.
## 9. Routing and static deployment

The application uses browser history routes:

```text
/
/connect
/users
/nodes
/routes
/preauth-keys
/settings
```

The production output is relocatable. A single build can be served at `/`, `/admin/`, or another validated subpath. Docker selects the public path at startup through `APP_BASE_PATH` and generates the runtime Nginx site accordingly.

Static servers must:

- Serve real assets normally.
- Return `index.html` for supported application routes.
- Redirect trailing-slash route forms to their canonical paths.
- Return 404 for unsupported paths.
- Route `/api/*` and `/version` to Headscale before any SPA handling in same-origin deployments.

The packaged container runs as non-root user `101`, listens on port `8080`, supports a read-only root filesystem with documented tmpfs mounts, and exposes `/healthz`.

## 10. Cross-origin deployment

Same-origin deployment is recommended because it avoids CORS and allows a narrow `connect-src 'self'` policy.

For an independent UI origin, Headscale or its reverse proxy must allow the exact UI origin on `/version` and `/api/v1/*`, including OPTIONS preflight. Wildcard origins and `connect-src *` are not recommended.

The UI keeps Fetch credentials at `same-origin` and does not send browser cookies to a cross-origin Headscale server.

## 11. Security design

The security boundary is documented in [`SECURITY.md`](../SECURITY.md). Important design rules include:

- Production deployments use HTTPS.
- The API key never appears in URLs or logs.
- Session storage is the default persistence mode.
- Persistent local storage requires explicit user choice.
- Headscale-provided text and API errors are rendered as text, not raw HTML.
- The application avoids unnecessary third-party scripts, remote fonts, advertising, and analytics.
- Deployments should use a restrictive Content Security Policy and security headers.
- Access to the UI should be limited to trusted administrators.

A static frontend cannot make an administrative API key secret from the browser. Features that require hidden credentials, centralized authorization, audit logging, or multi-user roles would require a separate server-side product mode.

## 12. Internationalization and accessibility

Vue I18n provides `en-US` and `zh-CN`. User-facing strings belong in locale files rather than directly in components. API details may be shown for diagnostics, while the main message remains localized.

Dates, relative time, and numbers use the active locale. English is the final fallback locale.

The UI aims for practical WCAG 2.1 AA behavior:

- Inputs have labels.
- Icon-only actions have accessible names.
- Color is not the only status signal.
- Core management flows are keyboard accessible.
- Dialogs and drawers manage focus.
- Responsive layouts preserve critical status and confirmation information.
- Reduced-motion preferences are respected where animation is used.

## 13. Query and mutation behavior

Vue Query keys are organized by system status, users, nodes, node details, and pre-authentication keys. Pages load data on entry, allow manual refresh, and optionally poll at the configured interval. Polling pauses when appropriate for an inactive browser tab.

Mutations invalidate or update all affected resources. Node and route changes refresh node collections and relevant details; user changes refresh dependent resources; pre-authentication key changes refresh their collection. Duplicate writes against the same resource are blocked while a request is active.

Destructive actions require confirmation. Forms remain available after recoverable failures so users can correct or retry them.

## 14. Quality gates

Pull requests should run:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm api:check
```

User-facing or release-critical changes should also run:

```bash
pnpm test:e2e
```

Tests cover domain mapping, URL and credential behavior, API request shapes, error mapping, components, connection flows, management operations, translations, and base-path routing. Mocked tests do not replace contract verification against the supported Headscale release line.

## 15. Known limitations and future compatibility

- The browser must hold the Headscale API key.
- Only one Headscale instance is active at a time.
- Only Headscale `0.29.x` is currently supported.
- ACL management is not included.
- There is no built-in identity, authorization, or audit backend.
- Online status uses polling rather than server push.

Headscale `0.30` and later API work must be treated as a deliberate compatibility effort. If future requirements include hidden credentials, SSO, RBAC, audit logs, or multi-instance management, the project should introduce an explicit optional backend architecture rather than pretending those guarantees can be provided by static client code.
