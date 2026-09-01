# Deploying Headscale Web

Headscale Web is an unofficial community UI and is not affiliated with or endorsed by the Headscale project.

## Before you deploy

- The current release line supports Headscale `0.29.x` and uses the `v0.29.3` API schema as its contract baseline.
- Use HTTPS for production deployments.
- Prefer same-origin deployment so that the UI and Headscale API share an origin and do not require CORS.
- Treat the Headscale API key as an administrative secret. Do not include it in URLs, images, logs, support requests, or public issue reports.
- Use a versioned release or image tag for reproducible deployments. `latest` is convenient for evaluation but is not an upgrade policy.

## Docker

Images for `linux/amd64` and `linux/arm64` are published to:

```text
ghcr.io/mystery00/headscale-web
mystery0/headscale-web
```

Run the UI at `/`:

```bash
docker run -d \
  --name headscale-web \
  --restart unless-stopped \
  --read-only \
  --tmpfs /var/cache/nginx:rw,noexec,nosuid,size=16m,mode=1777 \
  --tmpfs /var/run:rw,noexec,nosuid,size=16m,mode=1777 \
  -p 8080:8080 \
  mystery0/headscale-web:0.1.3
```

Run it at `/admin/`:

```bash
docker run -d \
  --name headscale-web \
  --restart unless-stopped \
  --read-only \
  -e APP_BASE_PATH=/admin/ \
  --tmpfs /var/cache/nginx:rw,noexec,nosuid,size=16m,mode=1777 \
  --tmpfs /var/run:rw,noexec,nosuid,size=16m,mode=1777 \
  -p 8080:8080 \
  mystery0/headscale-web:0.1.3
```

The container listens on port `8080`, runs as non-root user `101`, and exposes `/healthz` independently of the application base path. Both tmpfs mounts must be writable because Nginx creates runtime files at startup.

### Docker Compose

```yaml
services:
  headscale-web:
    image: mystery0/headscale-web:0.1.3
    restart: unless-stopped
    read_only: true
    environment:
      APP_BASE_PATH: /admin/
    tmpfs:
      - /var/cache/nginx:rw,noexec,nosuid,size=16m,mode=1777
      - /var/run:rw,noexec,nosuid,size=16m,mode=1777
    ports:
      - "8080:8080"
```

## Static release files

Each [GitHub Release](https://github.com/Mystery00/headscale-web/releases) provides a ready-to-serve build:

- `headscale-web-static.tar.gz`
- `headscale-web-static.zip`
- `SHA256SUMS`

Download and verify the latest archive on Linux:

```bash
curl -LO https://github.com/Mystery00/headscale-web/releases/latest/download/headscale-web-static.tar.gz
curl -LO https://github.com/Mystery00/headscale-web/releases/latest/download/SHA256SUMS
sha256sum --ignore-missing --check SHA256SUMS
mkdir -p dist
tar -xzf headscale-web-static.tar.gz -C dist
```

For a specific version, download the assets from that release page rather than using `latest` URLs.

The unchanged `dist/` directory can be served at `/`, `/admin/`, or another valid subpath. The public URL and the directory containing `index.html` must match. The supported client routes are:

```text
/connect
/users
/nodes
/routes
/preauth-keys
/settings
```

Redirect trailing-slash forms to the canonical route, return `index.html` for supported client routes, serve real static files normally, and return 404 for unsupported paths.

## Same-origin reverse proxy (recommended)

Use this routing model:

```text
https://headscale.example.com/admin/* -> Headscale Web
https://headscale.example.com/api/*   -> Headscale
https://headscale.example.com/version -> Headscale
```

The API and `/version` locations must be handled before the UI fallback. Do not allow them to reach SPA route handling.

In this layout the connection form automatically starts with the browser origin when no URL has been saved. The API key status panel also requires `GET /api/v1/apikey` to be routed to Headscale.

### Nginx

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

    location ~ ^/admin/(connect|users|nodes|routes|preauth-keys|settings)/$ {
        return 308 /admin/$1;
    }

    location ~ ^/admin/(connect|users|nodes|routes|preauth-keys|settings)$ {
        try_files /admin/index.html =404;
    }

    location = /admin/ {
        try_files /admin/index.html =404;
    }

    location /admin/ {
        try_files $uri =404;
    }
}
```

Keep the WebSocket, TLS, and proxy-header settings required by your Headscale deployment.

### Caddy

The checked-in [`Caddyfile`](../Caddyfile) contains the maintained root deployment example. For a subpath, proxy `/api/*` and `/version` first, then serve `/admin/index.html` for the supported UI routes and static assets. Preserve the TLS, headers, and WebSocket behavior required by your existing Headscale configuration.

## Independent origin

```text
https://admin.example.com     -> Headscale Web
https://headscale.example.com -> Headscale
```

Headscale or its reverse proxy must answer CORS for the UI origin on both `/version` and `/api/v1/*`:

```http
Access-Control-Allow-Origin: https://admin.example.com
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Vary: Origin
```

Answer OPTIONS preflight requests. Allow only the exact UI origin; do not use `*`. The UI does not send cookies to Headscale (`credentials` remains `same-origin`). Configure `connect-src` with the exact Headscale origin instead of `connect-src *`.

Because the browser origin is the UI origin in this model, replace the pre-filled URL with the independent Headscale origin before connecting. The CORS policy must permit the read-only `GET /api/v1/apikey` status request in addition to the existing API operations.

## Build from source

```bash
pnpm install --frozen-lockfile
pnpm build
docker build -t headscale-web .
```

The Docker image accepts `APP_BASE_PATH` at runtime. It must start and end with `/`, and must not contain empty, `.` or `..` segments, backslashes, query strings, fragments, whitespace, control characters, or configuration syntax.

## Optional access control

Authelia, Authentik, OAuth2 Proxy, and Cloudflare Access can restrict access to the UI. They do not replace the Headscale API key and do not change the browser-based security model. Read [`SECURITY.md`](../SECURITY.md) before deploying the UI on a public network.

## Node authentication approval

When a node joins without a pre-authentication key, Headscale displays a URL such as `/register/<auth-id>`. A front reverse proxy can temporarily redirect that URL to the SPA's flat route:

```nginx
location ~ ^/register/(hskey-authreq-[A-Za-z0-9_-]{24})$ {
    add_header Cache-Control "no-store" always;
    return 302 /admin/register?authId=$1;
}

location ~ ^/auth/(hskey-authreq-[A-Za-z0-9_-]{24})$ {
    add_header Cache-Control "no-store" always;
    return 302 /admin/auth?authId=$1;
}
```

Replace `/admin/` with the configured `APP_BASE_PATH`; for a root deployment use `/register` and `/auth`. Continue proxying `/api/*`, `/version`, and Headscale control/Noise/WebSocket paths to Headscale. Use `302`, not `301` or `308`, because Auth IDs are short-lived. Do not intercept `/register/confirm/*` or `/oidc/callback`, and do not enable this manual flow when Headscale OIDC is configured. Pending Auth IDs normally expire after about 15 minutes and are lost when Headscale restarts.

After the redirect, Headscale Web asks for the target user and calls the authenticated Headscale 0.29.x API. The browser must have a valid administrative API key. The UI also supports `/auth?authId=<id>` for approving or rejecting existing-node re-authentication requests.
