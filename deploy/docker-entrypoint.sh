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

case "$base_path" in
  *[!A-Za-z0-9._~/-]*) invalid_base_path ;;
esac

if ! printf '%s' "$base_path" | grep -Eq '^/([A-Za-z0-9._~-]+/)*$'; then
  invalid_base_path
fi

case "$base_path" in
  */./*|*/../*) invalid_base_path ;;
esac

mkdir -p "$runtime_dir" "$site_root"
rm -rf "$runtime_dir"/* "$site_root"/*

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
        absolute_redirect off;

        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy no-referrer always;
        add_header Content-Security-Policy "default-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'" always;

        location = /healthz {
            default_type text/plain;
            return 200 'ok';
        }
NGINX_HEADER

for route in connect users nodes routes preauth-keys settings; do
  route_path=${base_path}${route}
  route_with_trailing_slash=${route_path}/
  cat >> "$config_file" <<NGINX_ROUTE

        location = "$route_path" {
            try_files "${base_path}index.html" =404;
        }

        location = "$route_with_trailing_slash" {
            return 308 "$route_path";
        }
NGINX_ROUTE
done

if [ "$base_path" = / ]; then
  cat >> "$config_file" <<'NGINX_ROOT'

        location = / {
            try_files /index.html =404;
        }

        location / {
            try_files $uri =404;
        }
NGINX_ROOT
else
  base_without_trailing_slash=${base_path%/}
  cat >> "$config_file" <<NGINX_SUBPATH

        location = "$base_without_trailing_slash" {
            return 308 "$base_path";
        }

        location = "$base_path" {
            try_files "${base_path}index.html" =404;
        }

        location "$base_path" {
            try_files \$uri =404;
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
