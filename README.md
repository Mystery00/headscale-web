# Headscale Web

A static web UI for [Headscale](https://github.com/juanfont/headscale).

Unofficial community UI for Headscale. Not affiliated with the Headscale project.

## Status

Implementation in progress for Headscale `0.29.x`. The product name is not version-locked.

## Design

See [docs/design.md](docs/design.md). Deploy notes: [docs/deploy.md](docs/deploy.md).

## Develop

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

`VITE_BASE_PATH` must start and end with `/`. Example: `VITE_BASE_PATH=/admin/ pnpm build`.

## License

License is not chosen yet.
