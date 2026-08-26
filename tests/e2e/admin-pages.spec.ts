import { expect, test, type Page } from '@playwright/test'

const headscale = 'http://127.0.0.1:18080'

async function resetMock() {
  await fetch(`${headscale}/__mock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      version: '0.29.3',
      failAuth: false,
      users: [
        { id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' },
        { id: '2', name: 'platform', createdAt: '2024-02-03T04:05:06Z' },
      ],
    }),
  })
}

async function connect(page: Page) {
  await page.goto('/connect')
  await page.getByLabel('Headscale URL').fill(headscale)
  await page.getByRole('textbox', { name: 'API Key' }).fill('good-key')
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

test.beforeEach(async () => {
  await resetMock()
})

test('renders every authenticated page on desktop', async ({ page }) => {
  await connect(page)

  const pages = [
    { path: '/', heading: 'Dashboard' },
    { path: '/users', heading: 'Users', table: 'Users' },
    { path: '/nodes', heading: 'Nodes', table: 'Nodes' },
    { path: '/routes', heading: 'Routes', table: 'Routes' },
    { path: '/preauth-keys', heading: 'PreAuth Keys', table: 'PreAuth Keys' },
    { path: '/settings', heading: 'Settings' },
  ]

  for (const target of pages) {
    await page.goto(target.path)
    await expect(page.getByRole('heading', { name: target.heading, exact: true })).toBeVisible()
    if (target.table) await expect(page.getByRole('table', { name: target.table })).toBeVisible()
  }
})

test('keeps every authenticated page contained at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await connect(page)

  for (const target of [
    { path: '/', heading: 'Dashboard' },
    { path: '/users', heading: 'Users' },
    { path: '/nodes', heading: 'Nodes' },
    { path: '/routes', heading: 'Routes' },
    { path: '/preauth-keys', heading: 'PreAuth Keys' },
    { path: '/settings', heading: 'Settings' },
  ]) {
    await page.goto(target.path)
    await expect(page.getByRole('heading', { name: target.heading, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      toolbarHeight: document.querySelector('.page-toolbar')?.getBoundingClientRect().height ?? 0,
    }))
    expect(layout.overflow).toBeLessThanOrEqual(1)
    expect(layout.toolbarHeight).toBeLessThan(180)
  }
})
