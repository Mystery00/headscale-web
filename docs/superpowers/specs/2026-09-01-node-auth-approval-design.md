# Node authentication approval flow design

- Date: 2026-09-01
- Status: Approved for implementation
- Scope: Headscale 0.29.x, including new registration and re-authentication approval flows

## Goal

Allow an administrator to complete Headscale's no-pre-auth-key node authentication flow in Headscale Web. A front Nginx receives Headscale's `/register/<auth-id>` or `/auth/<auth-id>` URL and temporarily redirects it to a same-origin SPA route. Headscale Web then uses the existing administrative API key to register the new node under a selected user, or approve/reject an existing node re-authentication request.

## Architecture and routes

Headscale Web remains a static SPA with no backend. The front proxy owns the external integration:

```text
GET /register/<auth-id> -> 302 <APP_BASE_PATH>register?authId=<auth-id>
GET /auth/<auth-id>     -> 302 <APP_BASE_PATH>auth?authId=<auth-id>
```

The redirect is temporary and marked `Cache-Control: no-store`. The Auth ID is strictly matched as `hskey-authreq-` plus 24 URL-safe characters. Only these GET routes are intercepted; Headscale API, control protocol, OIDC confirmation, and callback routes continue to Headscale.

The SPA adds flat routes `/register` and `/auth`. Flat routes preserve the existing relative asset behavior for `/`, `/admin/`, and other valid `APP_BASE_PATH` deployments. Docker's runtime Nginx adds both routes to its supported SPA fallback set.

## Application layers

Add an auth repository behind the existing HTTP abstraction with operations:

- `register(authId, userName)`, calling `POST /api/v1/auth/register` with `{ authId, user }` and returning a mapped node.
- `approve(authId)`, calling `POST /api/v1/auth/approve` with `{ authId }`.
- `reject(authId)`, calling `POST /api/v1/auth/reject` with `{ authId }`.

Add query/mutation integration and invalidate the node collection after successful registration. Mutations never retry automatically. Generated API types remain behind the repository boundary.

Implement a reusable authentication request page with registration and re-authentication modes. Registration loads users, requires a selected user, confirms the target user, and displays the resulting node. Re-authentication provides approve and reject actions without a user selector. Both modes offer rejection, disable all actions while pending, and transition to a terminal result after success.

## Connection recovery

If an approval route is opened without a usable API key or Headscale URL, redirect to `/connect` while preserving the full internal target. After successful connection, return to the original approval route. Redirect values must be internal paths only; reject absolute, protocol-relative, and otherwise external targets. Auth IDs are not persisted in application storage, logs, or error reporting. On terminal completion, remove the query Auth ID with `router.replace` while retaining a completion view.

## Security and data handling

Auth IDs are validated at the client boundary and again by Headscale. They are displayed masked and are sent only in API request bodies. The UI does not claim to know node identity before registration; it warns that the pending request must be trusted. Existing API-key security applies: the browser holds the admin API key, and same-origin HTTPS deployment is recommended.

Headscale's pending authentication cache is in-memory, normally expires after about 15 minutes, and is lost on restart. 404, 400, 401/403, 409, timeout, network, missing-node, and protocol errors receive localized actionable messages. Mutating requests remain available for manual retry except after terminal or clearly stale states.

## Deployment and documentation

Update deployment documentation with root and subpath examples, using `/admin/` as the concrete example while explaining substitution of `APP_BASE_PATH`. Document that Nginx must proxy `/api/*` and `/version` to Headscale, and that the interception must not be enabled when Headscale OIDC requires its native registration flow.

## Validation

Add unit/component/E2E coverage for Auth ID validation and masking, repository request shapes, registration and re-authentication actions, rejection, confirmation, pending-state locking, errors, secure connection recovery, base paths, and Docker SPA routes. Run lint, format check, typecheck, unit tests, build, API contract check, and E2E tests.
