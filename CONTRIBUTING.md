# Contributing to Headscale Web

Thank you for helping improve Headscale Web. Contributions should keep the project focused, maintainable, secure, and compatible with its documented Headscale API contract.

## Before opening a pull request

- Search existing [issues](https://github.com/Mystery00/headscale-web/issues) and pull requests.
- Open an issue before starting a large feature, compatibility change, or architectural change.
- Do not use public issues for vulnerabilities; follow [`SECURITY.md`](SECURITY.md).
- Keep changes focused. Unrelated refactors should be proposed separately.

## Development environment

Requirements:

- Node.js 22 or later
- pnpm 10.32.0, as declared in `package.json`

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Start the development server:

```bash
pnpm dev
```

To proxy API requests to a development Headscale instance, create an ignored `.env.local` file:

```dotenv
HEADSCALE_PROXY_TARGET=https://your-headscale.example.com
```

Restart the development server and use the Vite origin, such as `http://localhost:5173`, as the Headscale URL. Never commit `.env.local`, API keys, or private server addresses.

## Project checks

Run the checks relevant to your change before submitting a pull request:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm api:check
```

Run browser tests for user-facing flows or release-related changes:

```bash
pnpm test:e2e
```

Use `pnpm format` to apply the repository formatting rules.

## Headscale API contract

The current release line targets Headscale `0.29.x` and keeps the `v0.29.3` Swagger contract under `specs/`.

When intentionally updating the API contract:

```bash
pnpm api:fetch
pnpm api:convert
pnpm api:generate
pnpm api:check
```

Review generated changes carefully. Generated API types should remain behind the client, repository, and mapper layers; UI components should not construct API URLs or authorization headers directly.

Compatibility changes must document the supported Headscale version and should include contract or integration test evidence.

## Code and product guidelines

- Use TypeScript and follow existing Vue 3 Composition API patterns.
- Keep server data in TanStack Vue Query rather than duplicating it in Pinia.
- Keep credentials within the credential store; never log or place them in URLs or error reports.
- Preserve string handling for Headscale `uint64` identifiers.
- Add or update English and Simplified Chinese translations for user-facing text.
- Do not render Headscale-provided values or API errors as raw HTML.
- Add confirmation and clear feedback for destructive or security-sensitive operations.
- Avoid adding a backend, authentication system, multi-instance support, ACL editor, or broader Headscale-version compatibility without prior design discussion.

## Documentation and screenshots

Public project documentation is written in English. User interface translations remain available in the application.

Screenshots must be sanitized according to [`docs/images/README.md`](docs/images/README.md). Do not submit images containing real credentials, private infrastructure details, personal data, browser notifications, or unrelated account information.

## Pull request expectations

A good pull request includes:

- A concise explanation of the problem and solution
- The supported Headscale version or API impact, when relevant
- Tests for behavior changes
- Documentation updates for user-visible changes
- Screenshots for visual changes, with sensitive information removed
- A list of validation commands that were run

Keep generated files and lockfile changes in the same pull request when they are required by the source change. Do not include build output, local environment files, test artifacts, or IDE settings.

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
