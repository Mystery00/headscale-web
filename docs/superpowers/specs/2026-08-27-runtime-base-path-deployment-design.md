# Runtime Base Path and Static Deployment Design

## Summary

Headscale Web will be built once with relocatable asset URLs. The same build output can be hosted at `/`, `/admin/`, or a deeper path without rebuilding. The browser will derive the Vue Router base path from the URL of the loaded application module. Docker deployments will use the runtime `APP_BASE_PATH` environment variable to place the static build under the requested path and generate the matching Nginx SPA fallback configuration.

Bare static-file deployments will not require or include a configuration generator. Operators will copy the contents of `dist/` into the directory that corresponds to the desired public URL and configure their static server to fall back to that directory's `index.html`.

## Goals

- Build one frontend artifact that can be hosted at arbitrary same-origin paths.
- Replace the build-time `VITE_BASE_PATH` deployment contract.
- Support Docker runtime configuration through `APP_BASE_PATH`.
- Preserve non-root and read-only Docker operation.
- Document direct static-file deployment without requiring Node.js or helper scripts on the target server.
- Provide Nginx and Caddy examples for root and subpath hosting.

## Non-goals

- Runtime selection of the Headscale API origin.
- Serving assets from a separate CDN origin.
- Supporting rewrites where the browser-visible application path differs from the static file directory.
- Removing the requirement for SPA fallback configuration.
- Replacing external authentication or authorization controls.

## Relocatable Frontend Build

Vite will use `base: './'`. Generated JavaScript, CSS, favicon, and other asset references will therefore be relative instead of being compiled for a fixed absolute path.

The existing `VITE_BASE_PATH` setting and its build argument will be removed. A build will no longer differ between `/` and `/admin/` deployments.

### Runtime Router Base Detection

The application entry module is emitted below the `assets/` directory. The router base can therefore be derived from the module URL by resolving its parent directory:

```ts
export function deriveBasePathFromModuleUrl(moduleUrl: string): string {
  return new URL('../', moduleUrl).pathname
}
```

Examples:

```text
https://example.com/assets/index.js
  -> /

https://example.com/admin/assets/index.js
  -> /admin/

https://example.com/tools/headscale/assets/index.js
  -> /tools/headscale/
```

`createAppRouter` will receive the derived base path instead of reading `import.meta.env.BASE_URL`. The production entry point will pass `import.meta.url`. Tests can pass explicit module URLs.

This design assumes that the generated application bundle remains in its normal `assets/` directory next to `index.html`.

## Bare Static-file Deployment

No deployment script or `.mjs` configuration tool will be supplied.

### Root Deployment

Copy the contents of `dist/` directly into the web root:

```text
/srv/headscale-web/
├── index.html
├── assets/
└── favicon.svg
```

Public URL:

```text
https://admin.example.com/
```

The server must fall back to `/index.html` for application routes.

### Subpath Deployment

Copy the contents of `dist/` into the directory matching the public path:

```text
/srv/www/
└── admin/
    ├── index.html
    ├── assets/
    └── favicon.svg
```

Public URL:

```text
https://example.com/admin/
```

The server must fall back to `/admin/index.html` for routes below `/admin/`. Requests outside `/admin/` must not fall through to the application.

### Static Server Requirements

- Serve files without rewriting asset requests to another origin.
- Preserve the browser-visible deployment path.
- Return the deployment directory's `index.html` for unknown application routes.
- Configure `/api/*` and `/version` proxy locations before the SPA fallback when Headscale shares the origin.
- Keep the current CSP and CORS guidance.

Documentation will contain complete Nginx and Caddy examples for root and `/admin/` deployments.

## Docker Runtime Configuration

The Docker image will accept:

```text
APP_BASE_PATH=/
```

The default is `/`.

Example:

```bash
docker run \
  -e APP_BASE_PATH=/admin/ \
  --read-only \
  --tmpfs /var/cache/nginx:rw,noexec,nosuid,size=16m,mode=1777 \
  --tmpfs /var/run:rw,noexec,nosuid,size=16m,mode=1777 \
  -p 8080:8080 \
  headscale-web
```

### Validation

`APP_BASE_PATH` must:

- Start with `/`.
- End with `/`.
- Not contain `//`.
- Not contain `.` or `..` path segments.
- Not contain backslashes, query strings, or fragments.

Invalid values will cause the container to exit before Nginx starts.

### Container Filesystem Layout

The immutable build output will be stored in the image under:

```text
/opt/headscale-web/
```

The image pre-creates the dedicated runtime directories under `/var/run` with ownership for user `101`. At startup, the non-root entrypoint prepares the writable site tree and places the build at the configured path. For read-only containers, `/var/run` must be mounted as a writable tmpfs accessible to user `101`.

For `/admin/`:

```text
/var/run/headscale-web-site/
└── admin/
    ├── index.html
    ├── assets/
    └── favicon.svg
```

For `/`:

```text
/var/run/headscale-web-site/
├── index.html
├── assets/
└── favicon.svg
```

The entrypoint will generate the Nginx configuration at `/var/run/headscale-web/nginx.conf` with:

- `/healthz` available independently of the application base path.
- A location restricted to `APP_BASE_PATH`.
- Static file lookup rooted at `/var/run/headscale-web-site`.
- SPA fallback to `${APP_BASE_PATH}index.html`.
- A 404 response outside the configured application path, except `/healthz`.
- Existing security headers.

Nginx will continue to listen on port `8080` and run as user `101`.

## Same-origin Headscale Deployment

For a same-origin `/admin/` deployment, the reverse proxy order remains:

1. `/api/*` to Headscale.
2. `/version` to Headscale.
3. `/admin/*` to Headscale Web.

API and version requests must never reach the SPA fallback.

## Independent-origin Deployment

Independent-origin deployment remains supported. Headscale or its reverse proxy must allow the UI origin through explicit CORS headers for `/version` and `/api/v1/*`. The CSP `connect-src` directive must explicitly include the Headscale origin.

## Repository Changes

Expected implementation areas:

- `vite.config.ts`: switch to relative build assets and remove `VITE_BASE_PATH` handling.
- `src/domain/url.ts` or a focused deployment-domain module: expose tested module-URL base derivation.
- `src/router/index.ts`: accept a runtime base path.
- `src/main.ts`: derive the base from `import.meta.url`.
- `Dockerfile`: remove the build argument, store immutable assets under `/opt`, and install the runtime entrypoint.
- `deploy/`: add the non-root startup script and Nginx template or generated configuration support.
- `docs/deploy.md`: replace build-time instructions with Docker runtime and direct file-placement instructions.
- `README.md`: remove `VITE_BASE_PATH` development guidance.
- `Caddyfile`: align the example with relocatable static output or clearly identify its intended root deployment mode.

## Testing

Automated coverage will include:

- Unit tests deriving `/`, `/admin/`, and nested base paths from module URLs.
- Validation tests for accepted and rejected `APP_BASE_PATH` values where practical.
- Router tests proving navigation works with an injected subpath base.
- Existing component and end-to-end tests under the root base.
- Production build verification that generated asset references are relative.
- Docker smoke tests for `/` and `/admin/`, including direct application routes and `/healthz`, when the local Docker environment is available.

## Migration and Compatibility

- Existing root deployments continue to work with the default `APP_BASE_PATH=/`.
- Existing Docker builds using `--build-arg VITE_BASE_PATH=...` must switch to `-e APP_BASE_PATH=...` at container startup.
- Existing manually built subpath deployments no longer need separate builds. They copy the same `dist/` contents into the desired path directory.
- Static servers still require a correctly scoped SPA fallback.
