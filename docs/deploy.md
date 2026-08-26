# Deploying Headscale Web

Unofficial community UI. Not affiliated with the Headscale project.

`VITE_BASE_PATH` is a **build-time** argument. It is not read from the container environment at startup. It must start and end with `/`.

## Same origin `/admin/`

```text
https://headscale.example.com/admin/* → this UI
https://headscale.example.com/api/*   → Headscale
https://headscale.example.com/version → Headscale
```

Build:

```bash
VITE_BASE_PATH=/admin/ pnpm build
```

Same-origin does not need CORS. The UI can use `window.location.origin` as the Headscale URL. CSP `connect-src 'self'` is enough.

Nginx must proxy Headscale **before** the SPA fallback. Do not let `/api/*` or `/version` fall through to `index.html`. Keep your existing Headscale WebSocket/proxy settings; this snippet only shows the extra admin location:

```nginx
location /api/ {
    proxy_pass http://headscale:8080;
}

location = /version {
    proxy_pass http://headscale:8080;
}

location /admin/ {
    alias /usr/share/nginx/html/admin/;
    try_files $uri $uri/ /admin/index.html;
}
```

## Independent origin

```text
https://admin.example.com → this UI
https://headscale.example.com → Headscale
```

Headscale (or its reverse proxy) must answer CORS for the admin origin on **both** `/version` and `/api/v1/*`:

```http
Access-Control-Allow-Origin: https://admin.example.com
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Vary: Origin
```

Answer OPTIONS preflight. Do not use `*`. Do not recommend `connect-src *`. Add the Headscale origin to CSP `connect-src` explicitly.

The UI does not send cookies to Headscale (`credentials` stays `same-origin`).

## Docker

```bash
docker build --build-arg VITE_BASE_PATH=/ -t headscale-web .
docker run --read-only --tmpfs /var/cache/nginx --tmpfs /var/run -p 8080:8080 headscale-web
```

The image serves static files as non-root and exposes `/healthz`. Changing the subpath later requires a rebuild.

## Optional access control

Authelia, Authentik, OAuth2 Proxy, or Cloudflare Access can restrict who opens the page. They do not replace the Headscale API key.
