# Changelog

## 0.1.3

### Added

- The connection page pre-fills the Headscale URL from the current page origin when no saved URL exists.
- Settings shows the status and expiration of the API key used by this browser.
- When the API key expires within 30 days, Settings shows a guide for manually replacing it with a key created from the CLI.

### Security

- API keys are never created, rotated, or revoked automatically by the browser; replace an expiring key manually.
