import { mkdir, writeFile } from 'node:fs/promises'

const SOURCE =
  'https://raw.githubusercontent.com/juanfont/headscale/v0.29.3/gen/openapiv2/headscale/v1/headscale.swagger.json'

const response = await fetch(SOURCE)
if (!response.ok) {
  throw new Error(`Failed to download swagger: ${response.status}`)
}

await mkdir('specs', { recursive: true })
await writeFile('specs/headscale.swagger.json', await response.text(), 'utf8')
