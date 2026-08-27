# Deploying Headscale Web

Unofficial community UI. Not affiliated with the Headscale project.

## Build once

```bash
pnpm install --frozen-lockfile
pnpm build
```

The production build is relocatable. The same `dist/` contents can be served at `/`, `/admin/`, or a deeper same-origin path without rebuilding. No base-path build variable is required.

The public URL and the directory containing `index.html` must match.

The application uses these single-segment client routes:

```text
/connect
/users
/nodes
/routes
/preauth-keys
/settings
```

Client routes use no trailing slash. Static servers should redirect a trailing-slash form such as `/nodes/` to `/nodes`, return `index.html` for the listed routes, serve real static files normally, and return 404 for unsupported multi-segment paths. This prevents relative assets from being resolved below a client route.

## Static files at `/`

Copy the contents of `dist/` directly into the configured web root:

```text
/srv/headscale-web/
|-- index.html
|-- assets/
`-- favicon.svg
```

Public URL:

```text
https://admin.example.com/
```

### Root Nginx example

```nginx
server {
    listen 8080;
    root /srv/headscale-web;

    location ~ ^/(connect|users|nodes|routes|preauth-keys|settings)/$ {
        return 308 /$1;
    }

    location ~ ^/(connect|users|nodes|routes|preauth-keys|settings)$ {
        try_files /index.html =404;
    }

    location = / {
        try_files /index.html =404;
    }

    location / {
        try_files $uri =404;
    }
}
```

The checked-in `Caddyfile` provides the equivalent root deployment example.

## Static files at `/admin/`

Copy the unchanged `dist/` contents into `/srv/www/admin/`:

```text
/srv/www/
`-- admin/
    |-- index.html
    |-- assets/
    `-- favicon.svg
```

Public URL:

```text
https://headscale.example.com/admin/
```

## Same-origin Nginx example

```text
https://headscale.example.com/admin/* -> this UI
https://headscale.example.com/api/*   -> Headscale
https://headscale.example.com/version -> Headscale
```

Proxy Headscale before handling UI files:

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

Keep your existing Headscale WebSocket, TLS, and proxy-header settings. Do not allow `/api/*` or `/version` to reach UI route handling.

## Same-origin Caddy example

```caddyfile
headscale.example.com {
    handle /api/* {
        reverse_proxy headscale:8080
    }

    handle /version {
        reverse_proxy headscale:8080
    }

    redir /admin /admin/ 308
    redir /admin/connect/ /admin/connect 308
    redir /admin/users/ /admin/users 308
    redir /admin/nodes/ /admin/nodes 308
    redir /admin/routes/ /admin/routes 308
    redir /admin/preauth-keys/ /admin/preauth-keys 308
    redir /admin/settings/ /admin/settings 308

    @admin_routes path /admin/ /admin/connect /admin/users /admin/nodes /admin/routes /admin/preauth-keys /admin/settings
    handle @admin_routes {
        root * /srv/www
        rewrite * /admin/index.html
        file_server
    }

    handle /admin/assets/* {
        root * /srv/www
        file_server
    }

    handle /admin/favicon.svg {
        root * /srv/www
        file_server
    }

    respond 404
}
```

## Independent origin

```text
https://admin.example.com     -> this UI
https://headscale.example.com -> Headscale
```

Headscale or its reverse proxy must answer CORS for the admin origin on both `/version` and `/api/v1/*`:

```http
Access-Control-Allow-Origin: https://admin.example.com
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Vary: Origin
```

Answer OPTIONS preflight. Do not use `*`. Do not recommend `connect-src *`. Add the Headscale origin to CSP `connect-src` explicitly.

The UI does not send cookies to Headscale (`credentials` stays `same-origin`).

## Docker

Build one generic image:

```bash
docker build -t headscale-web .
```

Run it at `/`, which is the default `APP_BASE_PATH`:

```bash
docker run --read-only \
  --tmpfs /var/cache/nginx:rw,noexec,nosuid,size=16m,mode=1777 \
  --tmpfs /var/run:rw,noexec,nosuid,size=16m,mode=1777 \
  -p 8080:8080 \
  headscale-web
```

Run the same image at `/admin/`:

```bash
docker run --read-only \
  -e APP_BASE_PATH=/admin/ \
  --tmpfs /var/cache/nginx:rw,noexec,nosuid,size=16m,mode=1777 \
  --tmpfs /var/run:rw,noexec,nosuid,size=16m,mode=1777 \
  -p 8080:8080 \
  headscale-web
```

The container:

- Runs as non-root user `101`.
- Listens on port `8080`.
- Exposes `/healthz` independently of the application base path.
- Stores immutable build output under `/opt/headscale-web/`.
- Creates the runtime site under `/var/run/headscale-web-site/`.
- Generates Nginx configuration at `/var/run/headscale-web/nginx.conf`.
- Redirects trailing-slash forms of supported client routes to their canonical URLs.
- Returns 404 for unsupported multi-segment paths and outside the configured subpath, except for `/healthz`.

`APP_BASE_PATH` defaults to `/`. It must start and end with `/` and must not contain empty segments (`//`), `.` or `..` segments, backslashes, query strings, fragments, whitespace, control characters, or configuration syntax. The container exits before starting Nginx when the value is invalid.

Both tmpfs mounts need a writable mode because the container process runs as user `101`.

## Optional access control

Authelia, Authentik, OAuth2 Proxy, or Cloudflare Access can restrict who opens the page. They do not replace the Headscale API key.