# Security Policy

## Supported versions

Security fixes are provided for the latest released version of Headscale Web. Users should upgrade to the newest stable release before reporting a problem that may already have been fixed.

The current release line supports Headscale `0.29.x`. Compatibility with other Headscale versions is outside the supported security and API contract boundary.

## Reporting a vulnerability

Do not report vulnerabilities, API keys, tokens, private URLs, or exploit details in a public GitHub issue.

Use the repository's private vulnerability reporting flow:

1. Open the [Security tab](https://github.com/Mystery00/headscale-web/security).
2. Select **Report a vulnerability**.
3. Include the affected Headscale Web version, deployment model, reproduction steps, impact, and any suggested mitigation.

If the private reporting option is unavailable, open a public issue containing only a request for a private contact channel. Do not include sensitive technical details in that issue.

Reports will be acknowledged as soon as practical. Maintainers may ask for additional information, coordinate a fix and release, and credit the reporter unless anonymity is requested.

## Security model

Headscale Web is a static browser application. It has no backend, database, identity provider, server-side session, or secret store.

The browser must hold the Headscale API key to call Headscale. Consequently:

- The API key is visible to the browser runtime.
- Browser extensions, injected scripts, or a compromised serving origin may be able to read it.
- Reverse-proxy authentication can restrict who opens the UI, but it cannot make the API key secret from an authorized browser session.
- Client-side encryption without a separate server-held secret would not remove this boundary.

Headscale Web stores API keys in `sessionStorage` by default. Users may explicitly choose persistent `localStorage`. Disconnecting clears the in-memory credential and both supported browser storage locations.

The Settings page makes a read-only `GET /api/v1/apikey` request to identify the active key by its non-secret prefix and display expiration metadata. It warns when the key expires within 30 days, but it does not create, rotate, expire, revoke, or delete API keys. Administrators must create and retire replacement keys with the Headscale CLI.

## Deployment recommendations

- Use HTTPS for the UI and Headscale API.
- Prefer a same-origin deployment when practical.
- Restrict UI access to trusted administrators and networks.
- Use a dedicated Headscale API key and rotate it if exposure is suspected.
- Pin a release version rather than relying on `latest` for unattended deployments.
- Keep the browser, reverse proxy, container runtime, and host operating system updated.
- Configure a restrictive Content Security Policy. Prefer `default-src 'self'` and list the exact Headscale origin in `connect-src` when cross-origin access is required.
- Set `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and a restrictive `frame-ancestors` policy.
- Do not expose Headscale's API directly to untrusted origins.
- Do not use wildcard CORS or `connect-src *`.

## Sensitive information

Never include the following in screenshots, logs, issues, discussions, or pull requests:

- Headscale API keys or authorization headers
- Pre-authentication keys
- Private hostnames, IP addresses, user identities, or email addresses
- Internal topology, routes, node keys, machine keys, or discovery keys
- Browser storage exports containing Headscale Web settings or credentials

When submitting screenshots, follow [`docs/images/README.md`](docs/images/README.md).

## Scope examples

Security reports may include, but are not limited to:

- Cross-site scripting that can expose API keys
- Credential leakage through URLs, logs, errors, or unintended persistence
- Authentication or access-control bypass in the packaged web server configuration
- Unsafe container defaults or writable paths that violate documented guarantees
- Supply-chain issues in release artifacts or published images

Configuration mistakes that contradict the deployment documentation may not be treated as product vulnerabilities, but clear documentation defects are still welcome as regular issues.
