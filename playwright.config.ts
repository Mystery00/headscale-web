import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node tests/e2e/mock-headscale.mjs',
      port: 18080,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
