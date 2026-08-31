# Headscale URL Origin and API Key Status Design

**Date:** 2026-08-31  
**Status:** Approved for specification review

## 1. Summary

Add two user-facing capabilities to Headscale Web:

1. Pre-fill the Headscale URL on the connection page from the current browser origin when no saved URL exists.
2. Show the current API key's metadata and expiration status in Settings, with a manual replacement guide when the key expires within 30 days.

This design deliberately does **not** grant the browser permission to create, rotate, or revoke API keys. The existing API key remains the only credential used by the UI.

## 2. Goals

- Reduce duplicate input for same-origin and static deployments.
- Make API key expiration visible before it interrupts administration.
- Help administrators replace an expiring key without adding an automatic credential-rotation transaction.
- Preserve the static frontend security boundary and existing storage behavior.
- Support Headscale `0.29.x`, using the repository's `v0.29.3` API contract.

## 3. Non-goals

- Automatically create a new API key.
- Automatically expire or revoke an existing API key.
- Store or retrieve a full API key from Headscale.
- Add a backend, BFF, server-side secret store, or additional authorization layer.
- Change the existing API key persistence choices.
- Implement API key management as a general-purpose page.

## 4. Connection URL behavior

The connection page initializes the URL with this priority:

```text
settings.baseUrl when present > window.location.origin
```

`window.location.origin` contains scheme, hostname, and port, but not the current pathname. For example, loading `/admin/connect` at `https://headscale.example.com` pre-fills `https://headscale.example.com`, not `/admin/connect`.

The value remains editable. The application does not automatically connect, save the value, or infer an API path from the page pathname. Existing saved settings always take precedence, including an explicitly saved value that differs from the current page origin.

The behavior must also work when the application is served at the root path, under `/admin/`, or from a static hosting origin such as the live demo.

## 5. API key metadata

### 5.1 API request

Settings may make a read-only request to:

```http
GET /api/v1/apikey
```

The request uses the existing API key and HTTP client. The repository layer, not the component, owns the generated OpenAPI client call and response mapping.

The response exposes metadata only:

- `id`
- masked `prefix`
- `expiration`
- `createdAt`
- `lastSeen`

Headscale does not return the full secret for an existing key.

### 5.2 Matching the current key

The browser uses the full key only in memory through the existing credential store and derives a safe lookup prefix for matching. It must not display or log the full key.

Supported key formats are:

- Current format: `hskey-api-{12-character-prefix}-{64-character-secret}`
- Legacy format: `{7-character-prefix}.{secret}`

The implementation should normalize the current credential to the same identifier representation used by Headscale's masked `prefix` response, without sending the secret to a new endpoint or storing derived secrets.

If the current key cannot be parsed, no matching key is returned, or the API request fails, Settings displays an unavailable status and continues to render the rest of the settings page.

## 6. Expiration states

Expiration is evaluated against the current client time:

| State | Condition | UI behavior |
|---|---|---|
| Healthy | More than 30 days remain | Show expiration and remaining time normally |
| Expiring soon | 0 to 30 days remain | Show warning status and the replacement guide |
| Expired | Expiration is in the past | Show error status and the replacement guide |
| No expiration | API returns no expiration | Show an explicit no-expiration state |
| Unavailable | Request, parsing, or matching fails | Show status unavailable; do not block settings |

The 30-day threshold is inclusive. A key with exactly 30 days remaining is `Expiring soon`.

Date rendering follows the application's active locale and date/time preference. Remaining-time calculations use absolute timestamps and must not depend on localized strings.

## 7. Manual replacement guide

The replacement action is an instructional flow, not an API mutation. When the key is `Expiring soon` or `Expired`, Settings shows a **Replace API key** action. Activating it reveals instructions similar to:

```bash
headscale apikeys create --expiration 90d
```

The guide explains:

1. Run the command on the Headscale server or a trusted administration host.
2. Paste the newly generated key into the existing API key field.
3. Use **Test connection** to validate it.
4. Save the settings after successful validation.
5. Revoke the old key separately with the Headscale CLI after confirming the new key works.

The UI shows the current masked prefix to help identify the old key. For revocation guidance it derives the safe database prefix only (12 characters for a current-format key or 7 characters for a legacy key) and may present a copyable command such as `headscale apikeys expire --prefix <prefix>`. It must never place wildcard masking characters in an unquoted shell command, show the full key, or invoke Headscale's create, expire, or delete API endpoints.

The manual flow works with both session and persistent credential storage. Testing and saving continue to follow the existing Settings behavior and explicit persistence choice. After a successful credential update, the API key metadata query is refreshed using the active credential so the status card identifies the replacement key.

## 8. Error handling and security

- Failure to load API key metadata must not prevent URL, appearance, polling, or credential settings from working.
- Unauthorized responses must follow the existing application error behavior; the metadata card must not leak raw credentials or request details.
- API keys must not appear in URLs, logs, browser error reports, screenshots, or localized messages.
- The metadata request must not expose the full key to component state beyond the existing credential store contract.
- The replacement guide must warn that a newly generated key is displayed only once by Headscale.
- The UI must not claim that a browser-side replacement flow provides atomic rotation. The old key remains active until the administrator explicitly revokes it.

## 9. Proposed implementation boundaries

Add or update the following areas:

- URL initialization in `src/features/connection/ConnectionPage.vue`.
- API key prefix parsing and expiration-state domain logic under `src/domain/`.
- A read-only API key repository under `src/repositories/`.
- Query integration for Settings, using the existing HTTP and query patterns.
- Settings UI in `src/features/settings/SettingsPage.vue`.
- English and Simplified Chinese translations.
- Unit and component tests for URL priority, key parsing, status boundaries, failures, and the non-mutating replacement guide.
- User-facing documentation in README, deployment, security, and architecture docs where the browser credential model is described.

No application code may call `fetch` directly from a page component, and no API key create/expire/delete endpoint is part of this feature.

## 10. Acceptance criteria

- Opening the connection page with no saved Headscale URL pre-fills `window.location.origin`.
- A saved Headscale URL takes precedence over the browser origin.
- The pathname and subpath are never appended to the inferred origin.
- Settings displays the current key's masked prefix and metadata when the read-only query succeeds.
- Exactly 30 days remaining is classified as expiring soon.
- Expiring and expired states expose the manual replacement guide and a safe old-key revocation command.
- Healthy, no-expiration, unavailable, and expired states have localized UI text.
- API metadata failure does not break the Settings page.
- The feature never calls API key creation, expiry, or deletion endpoints.
- Existing credential persistence behavior remains unchanged.
- All relevant tests, lint, typecheck, formatting, and production build pass.