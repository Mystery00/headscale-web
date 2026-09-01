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
      authRequests: ['hskey-authreq-abcdefghijklmnopqrstuvwx'],
      nodes: [
        {
          id: '42',
          name: 'laptop',
          givenName: 'alice-laptop',
          machineKey: 'mkey-test-fixture',
          nodeKey: 'nkey-test-fixture',
          discoKey: 'dkey-test-fixture',
          ipAddresses: ['100.64.0.2'],
          user: { id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' },
          lastSeen: '2024-02-01T00:00:00Z',
          createdAt: '2024-01-02T03:04:05Z',
          registerMethod: 'REGISTER_METHOD_AUTH_KEY',
          online: true,
          tags: ['tag:lab'],
          approvedRoutes: ['10.0.0.0/8'],
          availableRoutes: ['10.0.0.0/8'],
          subnetRoutes: ['10.0.0.0/8'],
        },
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

    if (target.path === '/users' || target.path === '/nodes') {
      await page.getByRole('button', { name: 'Details' }).first().click()
      const drawer = page.locator('.n-drawer-content-wrapper:visible').last()
      await expect
        .poll(async () => {
          const bounds = await drawer.boundingBox()
          return bounds ? Math.round(bounds.x + bounds.width) : Number.POSITIVE_INFINITY
        })
        .toBeLessThanOrEqual(390)
      const drawerBounds = await drawer.boundingBox()
      expect(drawerBounds).not.toBeNull()
      expect(drawerBounds!.x).toBeGreaterThanOrEqual(0)
      expect(drawerBounds!.width).toBeLessThanOrEqual(390)
    }
  }
})

test('returns from connection and approves a re-authentication request', async ({ page }) => {
  const authId = 'hskey-authreq-abcdefghijklmnopqrstuvwx'
  await page.goto('/auth?authId=' + authId)
  await expect(page).toHaveURL(/\/connect\?redirect=/)
  await page.getByLabel('Headscale URL').fill(headscale)
  await page.getByRole('textbox', { name: 'API Key' }).fill('good-key')
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect(page).toHaveURL(new RegExp('/auth\\?authId=' + authId + '$'))
  await page.getByRole('button', { name: 'Approve re-authentication' }).click()
  await page.getByRole('button', { name: 'Confirm approval' }).click()
  await expect(page).toHaveURL(/\/auth\?result=approved$/)
})

test('registers a new node under a selected user', async ({ page }) => {
  const authId = 'hskey-authreq-abcdefghijklmnopqrstuvwx'
  await connect(page)
  await page.goto('/register?authId=' + authId)
  await page.locator('.n-base-selection-label').click()
  await page.getByText('alice', { exact: true }).last().click()
  await page.getByRole('button', { name: 'Approve and register' }).click()
  await page.getByRole('button', { name: 'Confirm registration' }).click()
  await expect(page).toHaveURL(/\/register\?result=registered$/)
  await expect(page.getByText('registered-laptop')).toBeVisible()
})
