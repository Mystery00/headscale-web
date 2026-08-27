# Runtime Base Path Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Headscale Web once, host the same static output at any directory path, and let Docker select that path at container startup with `APP_BASE_PATH`.

**Architecture:** Vite emits relative asset URLs, while the application derives the Vue Router base from the deployed entry-module URL. The Docker image keeps immutable assets under `/opt/headscale-web`, then a non-root entrypoint copies them into `/var/run/headscale-web-site/<base-path>` and generates a matching Nginx configuration. Bare static deployments copy `dist/` directly into the directory represented by their public URL and configure a scoped SPA fallback.

**Tech Stack:** Vue 3, Vue Router 4, Vite 8, TypeScript 5, Vitest 4, Docker, POSIX shell, nginx-unprivileged 1.27, Nginx, Caddy

**Spec:** `docs/superpowers/specs/2026-08-27-runtime-base-path-deployment-design.md`

## Global Constraints

- The same `dist/` output must work at `/`, `/admin/`, and deeper same-origin paths without rebuilding.
- Remove the build-time `VITE_BASE_PATH` deployment contract.
- Docker runtime configuration uses `APP_BASE_PATH`, defaulting to `/`.
- `APP_BASE_PATH` must start and end with `/`, and must reject `//`, `.` or `..` segments, backslashes, query strings, and fragments.
- Runtime site files live under `/var/run/headscale-web-site/`; generated Nginx configuration lives at `/var/run/headscale-web/nginx.conf`.
- The Docker image must run as user `101`, listen on port `8080`, expose `/healthz`, and support `--read-only` with writable tmpfs mounts for `/var/run` and `/var/cache/nginx`.
- Bare static-file deployment must not require or include a deployment generator script.
- Same-origin reverse proxies must route `/api/*` and `/version` before the SPA fallback.
- Independent-origin CORS and CSP restrictions remain unchanged.
- Use test-driven development and commit each independently testable task.

## File Structure

- `src/domain/url.ts`: own the pure `deriveBasePathFromModuleUrl(moduleUrl)` browser-path derivation function alongside existing URL-domain helpers.
- `src/router/index.ts`: accept an explicit router base path and pass it to `createWebHistory`.
- `src/main.ts`: derive the deployed base from `import.meta.url` and construct the router with it.
- `vite.config.ts`: emit relocatable relative asset references while retaining the optional development-only Headscale proxy.
- `tests/unit/base-path.spec.ts`: verify root, one-level, nested, query/hash, and router-base behavior.
- `deploy/docker-entrypoint.sh`: validate `APP_BASE_PATH`, prepare runtime files, generate Nginx configuration, and exec Nginx as the final process.
- `Dockerfile`: produce one generic build and package immutable assets plus the runtime entrypoint.
- `tests/unit/docker-runtime-base.spec.ts`: opt-in Docker smoke coverage for root, subpath, direct routes, health, assets, and invalid input.
- `deploy/nginx-static.conf`: remove the obsolete fixed-root container configuration.
- `docs/deploy.md`: document Docker runtime configuration and direct static file placement with Nginx and Caddy examples.
- `README.md`: remove build-time base-path instructions and point operators to the deployment guide.
- `Caddyfile`: make the checked-in example an explicit root static-file deployment example.

---

### Task 1: Relocatable Frontend Assets and Runtime Router Base

**Files:**
- Modify: `tests/unit/base-path.spec.ts`
- Modify: `src/domain/url.ts`
- Modify: `src/router/index.ts`
- Modify: `src/main.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `deriveBasePathFromModuleUrl(moduleUrl: string): string`
- Produces: `createAppRouter(basePath?: string): Router`, with `/` as the test/default base
- Consumes: Vite's production `import.meta.url`
- Preserves: `HEADSCALE_PROXY_TARGET` development proxy behavior

- [ ] **Step 1: Replace the old build-time normalization tests with failing runtime-base tests**

Write `tests/unit/base-path.spec.ts` as:

```ts
import { describe, expect, it } from 'vitest'
import { deriveBasePathFromModuleUrl } from '@/domain/url'
import { createAppRouter } from '@/router'

describe('deriveBasePathFromModuleUrl', () => {
  it.each([
    ['https://example.com/assets/index.js', '/'],
    ['https://example.com/admin/assets/index.js', '/admin/'],
    ['https://example.com/tools/headscale/assets/index.js', '/tools/headscale/'],
    ['https://example.com/admin/assets/index.js?v=1#entry', '/admin/'],
  ])('derives the application base from %s', (moduleUrl, expected) => {
    expect(deriveBasePathFromModuleUrl(moduleUrl)).toBe(expected)
  })
})

describe('createAppRouter', () => {
  it('uses an injected deployment base', () => {
    const router = createAppRouter('/admin/')
    expect(router.options.history.base).toBe('/admin')
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
pnpm test -- tests/unit/base-path.spec.ts
```

Expected: FAIL because `deriveBasePathFromModuleUrl` is not exported and `createAppRouter` does not accept a base-path argument.

- [ ] **Step 3: Implement pure module-URL base derivation**

Replace the obsolete `normalizeBasePath` export at the top of `src/domain/url.ts` with:

```ts
export function deriveBasePathFromModuleUrl(moduleUrl: string): string {
  return new URL('../', moduleUrl).pathname
}
```

Keep all Headscale URL normalization code below it unchanged.

- [ ] **Step 4: Inject the base path into the router**

Change `src/router/index.ts` to import the `Router` type and accept a defaulted argument:

```ts
import { createRouter, createWebHistory, type Router } from 'vue-router'

export function createAppRouter(basePath = '/'): Router {
  const router = createRouter({
    history: createWebHistory(basePath),
    routes: [
      // Keep the existing route definitions unchanged.
    ],
  })
  router.beforeEach(requireConnection)
  return router
}
```

Only the import, function signature, return type, and `createWebHistory` argument change; preserve all existing routes and guards verbatim.

- [ ] **Step 5: Derive the production router base from the loaded entry module**

In `src/main.ts`, add:

```ts
import { deriveBasePathFromModuleUrl } from './domain/url'
```

Replace:

```ts
const router = createAppRouter()
```

with:

```ts
const router = createAppRouter(deriveBasePathFromModuleUrl(import.meta.url))
```

- [ ] **Step 6: Make Vite emit relative assets and remove `VITE_BASE_PATH`**

In `vite.config.ts`, delete the local `normalizeBasePath` function. Keep `loadEnv` because `HEADSCALE_PROXY_TARGET` still needs it. Set the returned configuration base directly:

```ts
return {
  base: './',
  plugins: [vue()],
  server: proxyTarget
    ? {
        proxy: {
          '/version': {
            target: proxyTarget,
            changeOrigin: true,
            secure: true,
          },
          '/api': {
            target: proxyTarget,
            changeOrigin: true,
            secure: true,
          },
        },
      }
    : undefined,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}
```

- [ ] **Step 7: Run the focused tests and type check**

Run:

```powershell
pnpm test -- tests/unit/base-path.spec.ts
pnpm typecheck
```

Expected: both commands PASS. Existing component helpers continue using the default `/` router base.

- [ ] **Step 8: Build and verify generated references are relative**

Run:

```powershell
pnpm build
$html = Get-Content dist\index.html -Raw
if ($html -notmatch '(src|href)="\./assets/') { throw 'Generated assets are not relative' }
if ($html -match '(src|href)="/assets/') { throw 'Generated assets still use an absolute root path' }
```

Expected: build PASS; the assertions produce no error.

- [ ] **Step 9: Commit the frontend relocation change**

```powershell
git add tests/unit/base-path.spec.ts src/domain/url.ts src/router/index.ts src/main.ts vite.config.ts
git commit -m "feat: derive router base from deployed assets"
```

---

### Task 2: Docker Runtime Base Path and Non-root Nginx Startup

**Files:**
- Create: `deploy/docker-entrypoint.sh`
- Create: `tests/unit/docker-runtime-base.spec.ts`
- Modify: `Dockerfile`
- Delete: `deploy/nginx-static.conf`

**Interfaces:**
- Consumes: `APP_BASE_PATH` environment variable, default `/`
- Consumes: immutable frontend files at `/opt/headscale-web/`
- Produces: runtime site tree at `/var/run/headscale-web-site/<base-path>`
- Produces: Nginx config at `/var/run/headscale-web/nginx.conf`
- Produces: HTTP `8080`, `/healthz`, base-scoped SPA fallback, and 404 outside a configured subpath

- [ ] **Step 1: Add an opt-in Docker smoke test before changing the image**

Create `tests/unit/docker-runtime-base.spec.ts`:

```ts
import { execFileSync, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const enabled = process.env.RUN_DOCKER_TESTS === '1'
const image = `headscale-web-runtime-base-test:${process.pid}`
const containers = new Set<string>()

function docker(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8' }).trim()
}

async function waitForHealth(origin: string): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${origin}/healthz`)
      if (response.ok && (await response.text()) === 'ok') return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw lastError ?? new Error('Container health check did not become ready')
}

async function startContainer(basePath: string): Promise<{ name: string; origin: string }> {
  const name = `headscale-web-${randomUUID()}`
  containers.add(name)
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    name,
    '-e',
    `APP_BASE_PATH=${basePath}`,
    '-p',
    '127.0.0.1::8080',
    image,
  )
  const portOutput = docker('port', name, '8080/tcp')
  const port = portOutput.split(':').at(-1)
  if (!port) throw new Error(`Cannot parse Docker port output: ${portOutput}`)
  const origin = `http://127.0.0.1:${port}`
  await waitForHealth(origin)
  return { name, origin }
}

async function expectApplicationAt(origin: string, basePath: string): Promise<void> {
  const response = await fetch(`${origin}${basePath}`)
  expect(response.status).toBe(200)
  const html = await response.text()
  const scriptPath = html.match(/<script[^>]+src="(\.\/assets\/[^"]+)"/)?.[1]
  expect(scriptPath).toBeTruthy()
  const assetResponse = await fetch(new URL(scriptPath!, `${origin}${basePath}`))
  expect(assetResponse.status).toBe(200)
  expect(assetResponse.headers.get('content-type')).not.toContain('text/html')
}

describe.runIf(enabled)('Docker runtime base path', () => {
  beforeAll(() => {
    docker('build', '-t', image, '.')
  }, 180_000)

  afterEach(() => {
    for (const name of containers) {
      spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' })
      containers.delete(name)
    }
  })

  afterAll(() => {
    spawnSync('docker', ['image', 'rm', '-f', image], { encoding: 'utf8' })
  })

  it('serves root deployment routes and health', async () => {
    const { origin } = await startContainer('/')
    await expectApplicationAt(origin, '/')
    expect((await fetch(`${origin}/nodes`)).status).toBe(200)
    expect((await fetch(`${origin}/healthz`)).status).toBe(200)
  })

  it('serves only the configured subpath and its direct routes', async () => {
    const { origin } = await startContainer('/admin/')
    await expectApplicationAt(origin, '/admin/')
    expect((await fetch(`${origin}/admin/nodes`)).status).toBe(200)
    expect((await fetch(`${origin}/admin`)).status).toBe(200)
    expect((await fetch(`${origin}/`)).status).toBe(404)
    expect((await fetch(`${origin}/healthz`)).status).toBe(200)
  })

  it.each(['admin/', '/admin', '/admin//', '/./admin/', '/../admin/', '/admin\\x/', '/admin/?x=1', '/admin/#x'])(
    'rejects invalid APP_BASE_PATH=%s',
    (basePath) => {
      const name = `headscale-web-invalid-${randomUUID()}`
      const result = spawnSync(
        'docker',
        ['run', '--name', name, '-e', `APP_BASE_PATH=${basePath}`, image],
        { encoding: 'utf8', timeout: 5_000 },
      )
      spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' })
      expect(result.status).not.toBe(0)
      expect(`${result.stdout}${result.stderr}`).toContain('Invalid APP_BASE_PATH')
    },
  )
})
```

This test is skipped in the normal suite and runs only when `RUN_DOCKER_TESTS=1` is explicitly set.

- [ ] **Step 2: Run the smoke test against the current image when Docker is available**

Check availability:

```powershell
docker version
```

If Docker is available, run:

```powershell
$env:RUN_DOCKER_TESTS = '1'
pnpm test -- tests/unit/docker-runtime-base.spec.ts
Remove-Item Env:RUN_DOCKER_TESTS
```

Expected before implementation: FAIL because `/admin/assets/*` is not served as an asset, outside-base requests are not restricted, and invalid values are not rejected.

If Docker is unavailable, record that the fail-first Docker smoke step could not run; continue with the test committed as opt-in coverage and run it before completion on any Docker-capable environment.

- [ ] **Step 3: Create the runtime entrypoint**

Create `deploy/docker-entrypoint.sh` with LF line endings:

```sh
#!/bin/sh
set -eu

base_path=${APP_BASE_PATH:-/}
runtime_dir=/var/run/headscale-web
site_root=/var/run/headscale-web-site
config_file=$runtime_dir/nginx.conf

invalid_base_path() {
  echo "Invalid APP_BASE_PATH: $base_path" >&2
  echo "Expected / or slash-delimited segments using letters, numbers, dot, underscore, tilde, or hyphen, with leading and trailing slashes." >&2
  exit 1
}

if ! printf '%s' "$base_path" | grep -Eq '^/([A-Za-z0-9._~-]+/)*$'; then
  invalid_base_path
fi

case "$base_path" in
  */./*|*/../*) invalid_base_path ;;
esac

rm -rf "$runtime_dir" "$site_root"
mkdir -p "$runtime_dir" "$site_root"

relative_path=${base_path#/}
relative_path=${relative_path%/}
target_dir=$site_root
if [ -n "$relative_path" ]; then
  target_dir=$site_root/$relative_path
fi
mkdir -p "$target_dir"
cp -R /opt/headscale-web/. "$target_dir/"

cat > "$config_file" <<'NGINX_HEADER'
worker_processes auto;
pid /var/run/headscale-web/nginx.pid;
error_log /dev/stderr notice;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    access_log /dev/stdout;
    sendfile on;

    server {
        listen 8080;
        server_name _;
        root /var/run/headscale-web-site;
        index index.html;

        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy no-referrer always;
        add_header Content-Security-Policy "default-src 'self'; connect-src 'self'; frame-ancestors 'none'" always;

        location = /healthz {
            default_type text/plain;
            return 200 'ok';
        }
NGINX_HEADER

if [ "$base_path" = / ]; then
  cat >> "$config_file" <<'NGINX_ROOT'

        location / {
            try_files $uri $uri/ /index.html;
        }
NGINX_ROOT
else
  base_without_trailing_slash=${base_path%/}
  cat >> "$config_file" <<NGINX_SUBPATH

        location = "$base_without_trailing_slash" {
            return 308 "$base_path";
        }

        location "$base_path" {
            try_files \$uri \$uri/ "${base_path}index.html";
        }

        location / {
            return 404;
        }
NGINX_SUBPATH
fi

cat >> "$config_file" <<'NGINX_FOOTER'
    }
}
NGINX_FOOTER

exec nginx -c "$config_file" -g 'daemon off;'
```

The strict safe-character expression also prevents quotes, whitespace, control characters, and Nginx configuration injection while supporting ordinary URL path segments.

- [ ] **Step 4: Package immutable assets and the entrypoint in Docker**

Replace `Dockerfile` with:

```dockerfile
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /app/dist /opt/headscale-web
COPY deploy/docker-entrypoint.sh /usr/local/bin/headscale-web-entrypoint
USER root
RUN chmod 0755 /usr/local/bin/headscale-web-entrypoint
USER 101
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/headscale-web-entrypoint"]
```

Delete `deploy/nginx-static.conf`; the entrypoint now generates the base-specific Nginx configuration.

- [ ] **Step 5: Run normal tests and static checks**

Run:

```powershell
pnpm test -- tests/unit/base-path.spec.ts tests/unit/docker-runtime-base.spec.ts
pnpm typecheck
pnpm lint
```

Expected: tests PASS with the Docker suite reported as skipped unless explicitly enabled; typecheck and lint PASS.

- [ ] **Step 6: Run Docker smoke coverage when Docker is available**

```powershell
$env:RUN_DOCKER_TESTS = '1'
pnpm test -- tests/unit/docker-runtime-base.spec.ts
Remove-Item Env:RUN_DOCKER_TESTS
```

Expected: root and `/admin/` containers pass asset, direct-route, health, redirect, path isolation, and invalid-value checks.

Also verify read-only mode manually:

```powershell
docker build -t headscale-web:read-only-test .
docker run --rm --read-only --tmpfs /var/cache/nginx:rw,noexec,nosuid,size=16m,mode=1777 --tmpfs /var/run:rw,noexec,nosuid,size=16m,mode=1777 -e APP_BASE_PATH=/admin/ -p 18080:8080 headscale-web:read-only-test
```

In another terminal:

```powershell
(Invoke-WebRequest http://127.0.0.1:18080/healthz -UseBasicParsing).Content
(Invoke-WebRequest http://127.0.0.1:18080/admin/nodes -UseBasicParsing).StatusCode
```

Expected: `ok` and `200`. Stop the foreground container with Ctrl+C.

If Docker is unavailable, preserve the opt-in test and explicitly report Docker smoke validation as a residual verification item rather than claiming it passed.

- [ ] **Step 7: Commit the Docker runtime deployment change**

```powershell
git add Dockerfile deploy/docker-entrypoint.sh tests/unit/docker-runtime-base.spec.ts
git rm deploy/nginx-static.conf
git commit -m "feat: configure Docker base path at runtime"
```

---

### Task 3: Direct Static-file Deployment Documentation

**Files:**
- Modify: `docs/deploy.md`
- Modify: `README.md`
- Modify: `Caddyfile`

**Interfaces:**
- Documents: direct placement of unchanged `dist/` contents at root or subpath
- Documents: `APP_BASE_PATH` Docker runtime usage
- Documents: scoped Nginx and Caddy SPA fallback
- Preserves: same-origin proxy order, independent-origin CORS, CSP, API-key, and optional access-control guidance

- [ ] **Step 1: Add documentation contract checks that initially fail**

Run this PowerShell assertion before editing documentation:

```powershell
$deploy = Get-Content docs\deploy.md -Raw
$readme = Get-Content README.md -Raw
if ($deploy -notmatch 'APP_BASE_PATH') { Write-Output 'Expected failure: APP_BASE_PATH is undocumented' }
if ($deploy -notmatch '/var/run/headscale-web-site') { Write-Output 'Expected failure: runtime directory is undocumented' }
if ($deploy -notmatch '/srv/www/admin') { Write-Output 'Expected failure: static subpath placement is undocumented' }
if ($readme -match 'VITE_BASE_PATH') { Write-Output 'Expected failure: README still documents VITE_BASE_PATH' }
```

Expected: all four failure messages are printed.

- [ ] **Step 2: Rewrite the deployment guide around build-once output**

Update `docs/deploy.md` with these exact operational sections and commands:

1. State that `pnpm build` creates one relocatable `dist/` artifact and that `VITE_BASE_PATH` no longer exists.
2. Root static placement:

```text
/srv/headscale-web/
├── index.html
├── assets/
└── favicon.svg
```

3. `/admin/` static placement:

```text
/srv/www/
└── admin/
    ├── index.html
    ├── assets/
    └── favicon.svg
```

4. Nginx same-origin example:

```nginx
server {
    listen 443 ssl;
    server_name headscale.example.com;
    root /srv/www;

    location /api/ {
        proxy_pass http://headscale:8080;
    }

    location = /version {
        proxy_pass http://headscale:8080;
    }

    location = /admin {
        return 308 /admin/;
    }

    location /admin/ {
        try_files $uri $uri/ /admin/index.html;
    }
}
```

5. Caddy same-origin example:

```caddyfile
headscale.example.com {
    handle /api/* {
        reverse_proxy headscale:8080
    }

    handle /version {
        reverse_proxy headscale:8080
    }

    redir /admin /admin/ 308

    handle /admin/* {
        root * /srv/www
        try_files {path} /admin/index.html
        file_server
    }
}
```

6. Docker root and subpath commands:

```bash
docker build -t headscale-web .
docker run --read-only \
  --tmpfs /var/cache/nginx:rw,noexec,nosuid,size=16m,mode=1777 \
  --tmpfs /var/run:rw,noexec,nosuid,size=16m,mode=1777 \
  -p 8080:8080 \
  headscale-web
```

```bash
docker run --read-only \
  -e APP_BASE_PATH=/admin/ \
  --tmpfs /var/cache/nginx:rw,noexec,nosuid,size=16m,mode=1777 \
  --tmpfs /var/run:rw,noexec,nosuid,size=16m,mode=1777 \
  -p 8080:8080 \
  headscale-web
```

7. Explicitly list the validation rules, `/healthz`, user `101`, port `8080`, `/var/run/headscale-web-site`, and `/var/run/headscale-web/nginx.conf`.
8. Retain independent-origin CORS headers, explicit CSP origin guidance, no-cookie behavior, and optional access-control guidance.

- [ ] **Step 3: Simplify README deployment guidance**

Remove the `VITE_BASE_PATH` paragraph from `README.md`. Keep the development proxy instructions unchanged, and add:

```markdown
The production build is relocatable. The same `dist/` output can be served at `/` or copied into a subdirectory such as `/admin/`. Docker deployments select the path at runtime with `APP_BASE_PATH`. See [docs/deploy.md](docs/deploy.md).
```

- [ ] **Step 4: Make the checked-in Caddyfile an explicit root static example**

Use this content in `Caddyfile`:

```caddyfile
:8080 {
	encode gzip
	root * /srv/headscale-web
	try_files {path} /index.html
	file_server
	header X-Content-Type-Options nosniff
	header Referrer-Policy no-referrer
	header Content-Security-Policy "default-src 'self'; connect-src 'self'; frame-ancestors 'none'"
	handle /healthz {
		respond "ok" 200
	}
}
```

The deployment guide, not this root-only example, contains the complete `/admin/` Caddy configuration.

- [ ] **Step 5: Run documentation assertions and formatting checks**

```powershell
$deploy = Get-Content docs\deploy.md -Raw
$readme = Get-Content README.md -Raw
if ($deploy -notmatch 'APP_BASE_PATH') { throw 'APP_BASE_PATH is undocumented' }
if ($deploy -notmatch '/var/run/headscale-web-site') { throw 'Runtime directory is undocumented' }
if ($deploy -notmatch '/srv/www/admin') { throw 'Static subpath placement is undocumented' }
if ($deploy -match 'VITE_BASE_PATH') { throw 'Deploy guide still documents VITE_BASE_PATH' }
if ($readme -match 'VITE_BASE_PATH') { throw 'README still documents VITE_BASE_PATH' }
pnpm format:check
```

Expected: assertions produce no errors and Prettier PASS.

- [ ] **Step 6: Commit deployment documentation**

```powershell
git add docs/deploy.md README.md Caddyfile
git commit -m "docs: explain relocatable static deployment"
```

---

### Task 4: Full Validation and Review

**Files:**
- Verify: all files changed by Tasks 1-3
- Compare against: `docs/superpowers/specs/2026-08-27-runtime-base-path-deployment-design.md`

**Interfaces:**
- Consumes: completed runtime-base implementation and deployment documentation
- Produces: verification evidence and a clean review verdict

- [ ] **Step 1: Run the complete automated suite**

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Expected: every command PASS. The opt-in Docker tests are skipped in the normal Vitest run.

- [ ] **Step 2: Verify the production artifact remains relocatable**

```powershell
$html = Get-Content dist\index.html -Raw
if ($html -notmatch '(src|href)="\./assets/') { throw 'Generated assets are not relative' }
if ($html -match '(src|href)="/assets/') { throw 'Generated assets use an absolute root path' }
if (Select-String -Path vite.config.ts,README.md,docs\deploy.md,Dockerfile -Pattern 'VITE_BASE_PATH') {
  throw 'Obsolete VITE_BASE_PATH references remain'
}
```

Expected: no errors and no obsolete deployment contract references.

- [ ] **Step 3: Run end-to-end tests at the default root base**

```powershell
pnpm test:e2e
```

Expected: all Playwright tests PASS with the relocatable build served at `/`.

- [ ] **Step 4: Run Docker smoke tests when Docker is available**

```powershell
$env:RUN_DOCKER_TESTS = '1'
pnpm test -- tests/unit/docker-runtime-base.spec.ts
Remove-Item Env:RUN_DOCKER_TESTS
```

Expected: all Docker tests PASS. If Docker is unavailable, report this command as not run and retain it as explicit residual verification; do not describe Docker behavior as locally verified.

- [ ] **Step 5: Inspect the final diff for safety and scope**

```powershell
git diff HEAD~3 --check
git diff HEAD~3 --stat
git status --short
```

Confirm manually:

- No production API calls or credentials changed.
- No deployment generator was added for bare static files.
- `/api/*` and `/version` precede SPA fallback in same-origin examples.
- Runtime files use `/var/run`, not `/tmp`.
- The subpath container returns 404 outside its configured base.
- The working tree contains only intentional changes.

- [ ] **Step 6: Request a defect-first code review**

Invoke the `requesting-code-review` skill and ask the reviewer to verify:

- `import.meta.url` derivation for root and nested paths.
- Relative Vite asset output.
- Shell path validation and Nginx configuration-injection resistance.
- Non-root and read-only filesystem behavior.
- Nginx location ordering, redirects, direct SPA routes, assets, and `/healthz`.
- Static Nginx/Caddy documentation correctness.
- Migration away from `VITE_BASE_PATH`.

Resolve every actionable finding with a focused test, rerun the affected checks, and commit fixes with a message describing the corrected behavior.

- [ ] **Step 7: Confirm final repository state**

```powershell
git status --short
git log -4 --oneline
```

Expected: clean working tree and separate commits for frontend relocation, Docker runtime deployment, and static deployment documentation, plus any narrowly scoped review-fix commit.
