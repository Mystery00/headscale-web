import { execFileSync, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const enabled = process.env.RUN_DOCKER_TESTS === '1'
const image = `headscale-web-runtime-base-test:${process.pid}`
const containers = new Set<string>()
const dockerExecutable = process.platform === 'win32' ? 'wsl.exe' : 'docker'
const dockerPrefix = process.platform === 'win32' ? ['--exec', 'docker'] : []

function docker(...args: string[]): string {
  return execFileSync(dockerExecutable, [...dockerPrefix, ...args], {
    encoding: 'utf8',
  }).trim()
}

function spawnDocker(args: string[], timeout?: number) {
  return spawnSync(dockerExecutable, [...dockerPrefix, ...args], {
    encoding: 'utf8',
    timeout,
  })
}

async function waitForHealth(origin: string): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${origin}/healthz`)
      if (response.ok && (await response.text()) === 'ok') return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw lastError ?? new Error('Container health check did not become ready')
}

async function startContainer(
  basePath: string,
  readOnly = false,
): Promise<{ name: string; origin: string }> {
  const name = `headscale-web-${randomUUID()}`
  containers.add(name)
  const readOnlyArgs = readOnly
    ? [
        '--read-only',
        '--tmpfs',
        '/var/cache/nginx:rw,noexec,nosuid,size=16m,mode=1777',
        '--tmpfs',
        '/var/run:rw,noexec,nosuid,size=16m,mode=1777',
      ]
    : []
  docker(
    'run',
    '-d',
    '--rm',
    ...readOnlyArgs,
    '--name',
    name,
    '-e',
    `APP_BASE_PATH=${basePath}`,
    '-p',
    '127.0.0.1::8080',
    image,
  )
  const portOutput = docker('port', name, '8080/tcp')
  const port = portOutput.split(':').at(-1)
  if (!port) throw new Error(`Cannot parse Docker port output: ${portOutput}`)
  const origin = `http://127.0.0.1:${port}`
  await waitForHealth(origin)
  return { name, origin }
}

async function expectApplicationAt(origin: string, path: string): Promise<Response> {
  const response = await fetch(`${origin}${path}`)
  expect(response.status).toBe(200)
  const html = await response.text()
  const scriptPath = html.match(/<script[^>]+src="(\.\/assets\/[^"]+)"/)?.[1]
  if (!scriptPath) throw new Error('Generated index does not reference a relative JavaScript asset')
  const assetResponse = await fetch(new URL(scriptPath, response.url))
  expect(assetResponse.status).toBe(200)
  expect(assetResponse.headers.get('content-type')).not.toContain('text/html')
  return response
}

describe.runIf(enabled)('Docker runtime base path', () => {
  beforeAll(() => {
    docker('build', '-t', image, '.')
  }, 300_000)

  afterEach(() => {
    for (const name of containers) {
      spawnDocker(['rm', '-f', name])
      containers.delete(name)
    }
  })

  afterAll(() => {
    spawnDocker(['image', 'rm', '-f', image])
  })

  it('serves root deployment routes and health', async () => {
    const { origin } = await startContainer('/')
    await expectApplicationAt(origin, '/')
    expect((await fetch(`${origin}/nodes`)).status).toBe(200)
    const trailingSlash = await expectApplicationAt(origin, '/nodes/')
    expect(trailingSlash.url).toBe(`${origin}/nodes`)
    expect((await fetch(`${origin}/settings/profile`)).status).toBe(404)
    expect((await fetch(`${origin}/healthz`)).status).toBe(200)
  })

  it('allows application styles while retaining the restrictive CSP', async () => {
    const { origin } = await startContainer('/admin/')
    const response = await expectApplicationAt(origin, '/admin/')

    expect(response.headers.get('content-security-policy')).toBe(
      "default-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
    )
  })

  it('serves only the configured subpath and its direct routes', async () => {
    const { origin } = await startContainer('/admin/', true)
    await expectApplicationAt(origin, '/admin/')
    expect((await fetch(`${origin}/admin/nodes`)).status).toBe(200)
    const trailingSlash = await expectApplicationAt(origin, '/admin/nodes/')
    expect(trailingSlash.url).toBe(`${origin}/admin/nodes`)
    expect((await fetch(`${origin}/admin/settings/profile`)).status).toBe(404)
    expect((await fetch(`${origin}/admin`)).status).toBe(200)
    expect((await fetch(`${origin}/`)).status).toBe(404)
    expect((await fetch(`${origin}/healthz`)).status).toBe(200)
  })

  it.each([
    'admin/',
    '/admin',
    '/admin//',
    '/./admin/',
    '/../admin/',
    '/admin\\x/',
    '/admin/?x=1',
    '/admin/#x',
    '/\n/admin/',
    '/\r/admin/',
  ])(
    'rejects invalid APP_BASE_PATH=%s',
    (basePath) => {
      const name = `headscale-web-invalid-${randomUUID()}`
      const result = spawnDocker(
        ['run', '--name', name, '-e', `APP_BASE_PATH=${basePath}`, image],
        5_000,
      )
      spawnDocker(['rm', '-f', name])
      expect(result.status).not.toBe(0)
      expect(`${result.stdout}${result.stderr}`).toContain('Invalid APP_BASE_PATH')
    },
  )
})