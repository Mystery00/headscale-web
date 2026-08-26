import { createServer } from 'node:http'

const port = Number(process.env.MOCK_HEADSCALE_PORT || 18080)
const state = {
  version: '0.29.3',
  failAuth: false,
  users: [{ id: '1', name: 'alice', createdAt: '2024-01-02T03:04:05Z' }],
}

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  })
  res.end(JSON.stringify(body))
}

function unauthorized(res) {
  json(res, 401, { code: 16, message: 'unauthenticated' })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
  if (req.method === 'OPTIONS') {
    json(res, 204, {})
    return
  }
  if (req.method === 'POST' && url.pathname === '/__mock') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    Object.assign(state, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
    json(res, 200, state)
    return
  }
  if (req.method === 'GET' && url.pathname === '/version') {
    json(res, 200, { version: state.version, commit: 'test' })
    return
  }
  const auth = req.headers.authorization
  if (state.failAuth || auth !== 'Bearer good-key') {
    unauthorized(res)
    return
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/health') {
    json(res, 200, { databaseConnectivity: true })
    return
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/user') {
    json(res, 200, { users: state.users })
    return
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/user') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    const user = {
      id: String(state.users.length + 1),
      name: body.name,
      createdAt: new Date().toISOString(),
    }
    state.users.push(user)
    json(res, 200, { user })
    return
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/node') {
    json(res, 200, { nodes: [] })
    return
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/preauthkey') {
    json(res, 200, { preAuthKeys: [] })
    return
  }
  json(res, 404, { message: 'not found' })
})

server.listen(port, () => {
  console.log(`mock headscale on ${port}`)
})
