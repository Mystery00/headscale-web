import { expect, test, type Page } from '@playwright/test'

const server = 'http://127.0.0.1:18080'
const sample = {
  groups: { 'group:ops': ['alice@'] },
  hosts: { office: '10.0.0.0/24' },
  tagOwners: { 'tag:lab': [] },
  grants: [
    {
      src: ['group:ops'],
      dst: ['tag:lab'],
      ip: ['tcp:443'],
      app: { 'example.com/cap': [{}] },
      via: ['tag:router'],
    },
  ],
  acls: [{ action: 'accept', proto: 'tcp', src: ['*'], dst: ['tag:lab:443'] }],
  ssh: [
    {
      action: 'check',
      src: ['group:ops'],
      dst: ['tag:lab'],
      users: ['root'],
      checkPeriod: '12h',
      acceptEnv: ['LANG'],
    },
  ],
  autoApprovers: { routes: { '10.0.0.0/24': ['group:ops'] }, exitNode: ['tag:router'] },
  nodeAttrs: [{ target: ['tag:lab'], attr: ['randomize-client-port'], ipPool: ['100.64.0.0/24'] }],
  tests: [{ src: 'alice@', proto: 'tcp', accept: ['tag:lab:443'], deny: ['tag:lab:22'] }],
  sshTests: [
    { src: 'alice@', dst: ['tag:lab'], accept: ['root'], deny: ['nobody'], check: ['root'] },
  ],
  randomizeClientPort: true,
}
async function connect(page: Page) {
  await page.goto('/connect')
  await page.getByLabel('Headscale URL').fill(server)
  await page.getByRole('textbox', { name: 'API Key' }).fill('good-key')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Access policy', exact: true }).click()
  await expect(page.getByRole('button', { name: 'HuJSON editor', exact: true })).toBeVisible()
}
test.beforeEach(async () => {
  await fetch(`${server}/__mock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      version: '0.29.6',
      failAuth: false,
      policy: JSON.stringify(sample, null, 2),
      policyMode: 'database',
      policyWrites: [],
    }),
  })
})

test('全部字段可视化编辑后与文本同步，校验确认才发布', async ({ page }, info) => {
  await connect(page)
  const sections: [string, [string, string][]][] = [
    [
      'Access rules',
      [
        ['grants.0.src', 'alice@'],
        ['grants.0.dst', 'tag:lab'],
        ['grants.0.ip', 'tcp:80\ntcp:443'],
        ['grants.0.app', '{"example.com/cap":[{"enabled":true}]}'],
        ['grants.0.via', 'tag:gateway'],
        ['acls.0.proto', 'udp'],
        ['acls.0.src', 'group:ops'],
        ['acls.0.dst', 'tag:lab:53'],
      ],
    ],
    ['Tag owners', [['tagOwners.tag:lab', 'group:ops']]],
    ['Groups', [['groups.group:ops', 'bob@']]],
    ['Host aliases', [['hosts.office', '10.1.0.0/16']]],
    [
      'SSH rules',
      [
        ['ssh.0.src', 'bob@'],
        ['ssh.0.dst', 'tag:lab'],
        ['ssh.0.users', 'autogroup:nonroot'],
        ['ssh.0.checkPeriod', '24h'],
        ['ssh.0.acceptEnv', 'LANG\nTERM'],
      ],
    ],
    [
      'Auto approvers',
      [
        ['autoApprovers.routes.10.0.0.0/24', 'tag:router'],
        ['autoApprovers.exitNode', 'group:ops'],
      ],
    ],
    [
      'Node attributes',
      [
        ['nodeAttrs.0.target', '*'],
        ['nodeAttrs.0.attr', 'randomize-client-port'],
        ['nodeAttrs.0.ipPool', '100.65.0.0/24'],
      ],
    ],
    [
      'Policy tests',
      [
        ['tests.0.src', 'bob@'],
        ['tests.0.proto', 'udp'],
        ['tests.0.accept', 'tag:lab:53'],
        ['tests.0.deny', 'tag:lab:80'],
        ['sshTests.0.src', 'bob@'],
        ['sshTests.0.dst', 'tag:server'],
        ['sshTests.0.accept', 'admin'],
        ['sshTests.0.deny', 'root'],
        ['sshTests.0.check', 'admin'],
      ],
    ],
  ]
  for (const [section, fields] of sections) {
    await page.getByRole('button', { name: section, exact: true }).click()
    for (const [name, value] of fields) await page.getByLabel(name, { exact: true }).fill(value)
  }
  await page.getByRole('button', { name: 'Global options', exact: true }).click()
  await page.getByLabel('randomizeClientPort', { exact: true }).selectOption('false')
  await page.getByRole('button', { name: 'HuJSON editor', exact: true }).click()
  const text = await page.getByLabel('Policy source').inputValue()
  expect(JSON.parse(text)).toEqual({
    groups: { 'group:ops': ['bob@'] },
    hosts: { office: '10.1.0.0/16' },
    tagOwners: { 'tag:lab': ['group:ops'] },
    grants: [
      {
        src: ['alice@'],
        dst: ['tag:lab'],
        ip: ['tcp:80', 'tcp:443'],
        app: { 'example.com/cap': [{ enabled: true }] },
        via: ['tag:gateway'],
      },
    ],
    acls: [{ action: 'accept', proto: 'udp', src: ['group:ops'], dst: ['tag:lab:53'] }],
    ssh: [
      {
        action: 'check',
        src: ['bob@'],
        dst: ['tag:lab'],
        users: ['autogroup:nonroot'],
        checkPeriod: '24h',
        acceptEnv: ['LANG', 'TERM'],
      },
    ],
    autoApprovers: { routes: { '10.0.0.0/24': ['tag:router'] }, exitNode: ['group:ops'] },
    nodeAttrs: [{ target: ['*'], attr: ['randomize-client-port'], ipPool: ['100.65.0.0/24'] }],
    tests: [{ src: 'bob@', proto: 'udp', accept: ['tag:lab:53'], deny: ['tag:lab:80'] }],
    sshTests: [
      { src: 'bob@', dst: ['tag:server'], accept: ['admin'], deny: ['root'], check: ['admin'] },
    ],
    randomizeClientPort: false,
  })
  await page.getByLabel('The server already uses database policy storage').check()
  await page.getByRole('button', { name: 'Validate policy', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Validation passed')
  await page.getByRole('button', { name: 'Review changes', exact: true }).first().click()
  await page.getByRole('button', { name: 'Publish policy', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft matches server')
  const saved = await fetch(`${server}/__mock`).then((res) => res.json())
  expect(saved.policyWrites).toEqual([text])
  await page.screenshot({ path: info.outputPath('policy-review.png'), fullPage: true })
})

test('文件模式拒绝保存时展示服务器原因并保留草稿', async ({ page }) => {
  await fetch(`${server}/__mock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ policyMode: 'file' }),
  })
  await connect(page)
  await page.getByRole('button', { name: 'HuJSON editor', exact: true }).click()
  await page.getByLabel('Policy source').fill('{"tagOwners":{"tag:new":[]}}')
  await page.getByLabel('The server already uses database policy storage').check()
  await page.getByRole('button', { name: 'Validate policy', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Validation passed')
  await page.getByRole('button', { name: 'Review changes', exact: true }).first().click()
  await page.getByRole('button', { name: 'Publish policy', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm publish', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'policy update is disabled' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'HuJSON editor', exact: true }).click()
  await expect(page.getByLabel('Policy source')).toHaveValue('{"tagOwners":{"tag:new":[]}}')
})

test('新增和删除字段保持空列表语义，支持导出并阻止意外离开', async ({ page }, info) => {
  await fetch(`${server}/__mock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ policy: '{/*keep*/}' }),
  })
  await connect(page)
  await page.getByRole('button', { name: 'Define grants', exact: true }).click()
  await page.getByRole('button', { name: '＋ Add rule', exact: true }).click()
  await page.getByLabel('grants.0.src', { exact: true }).fill('*')
  await page.getByLabel('grants.0.dst', { exact: true }).fill('tag:lab')
  await page.getByLabel('grants.0.ip', { exact: true }).fill('tcp:443')
  await page.screenshot({ path: info.outputPath('policy-visual.png'), fullPage: true })
  await page.getByRole('button', { name: 'Remove field grants.0', exact: true }).click()
  await page.getByRole('button', { name: 'HuJSON editor', exact: true }).click()
  const text = await page.getByLabel('Policy source').inputValue()
  expect(text).toContain('/*keep*/')
  expect(text).toMatch(/"grants"\s*:\s*\[\]/)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export draft', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('headscale-policy.hujson')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('link', { name: 'Nodes', exact: true }).click()
  await expect(page).toHaveURL(/\/policy$/)
})

test('策略表单和文本编辑器在移动宽度不撑破页面', async ({ page }, info) => {
  await connect(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: 'Access policy', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: info.outputPath('policy-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'HuJSON editor', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
