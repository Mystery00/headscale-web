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
RUN chmod 0755 /usr/local/bin/headscale-web-entrypoint \
    && mkdir -p /var/run/headscale-web /var/run/headscale-web-site \
    && chown -R 101:101 /var/run/headscale-web /var/run/headscale-web-site
USER 101
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/headscale-web-entrypoint"]