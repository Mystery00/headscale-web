import { expect, test } from '@playwright/test'

const headscale = 'http://127.0.0.1:18080'

async function resetMock(data: Record<string, unknown>) {
  await fetch(`${headscale}/__mock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

test.beforeEach(async () => {
  await resetMock({
    version: '0.29.3',
    failAuth: false,
    users: [{ id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' }],
  })
})

test('connects to a 0.29 instance', async ({ page }) => {
  await page.goto('/connect')
  await page.getByLabel('Headscale URL').fill(headscale)
  await page.getByRole('textbox', { name: 'API Key' }).fill('good-key')
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('rejects a non-0.29 version', async ({ page }) => {
  await resetMock({ version: '0.28.0' })
  await page.goto('/connect')
  await page.getByLabel('Headscale URL').fill(headscale)
  await page.getByRole('textbox', { name: 'API Key' }).fill('good-key')
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect(page.getByText('This UI only supports Headscale 0.29.x.')).toBeVisible()
})

test('creates a user', async ({ page }) => {
  await page.goto('/connect')
  await page.getByLabel('Headscale URL').fill(headscale)
  await page.getByRole('textbox', { name: 'API Key' }).fill('good-key')
  await page.getByRole('button', { name: 'Connect' }).click()
  await page.getByRole('link', { name: 'Users' }).click()
  await page.getByRole('button', { name: 'Create' }).click()
  await page.getByPlaceholder('Name').fill('bob')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('bob')).toBeVisible()
})

test('returns to connect after 401', async ({ page }) => {
  await page.goto('/connect')
  await page.getByLabel('Headscale URL').fill(headscale)
  await page.getByRole('textbox', { name: 'API Key' }).fill('good-key')
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await resetMock({ failAuth: true })
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(page.getByRole('heading', { name: 'Connect to Headscale' })).toBeVisible()
})
