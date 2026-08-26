import { http, HttpResponse } from 'msw'

const user = {
  id: '1',
  name: 'alice',
  displayName: 'Alice',
  email: 'alice@example.com',
  provider: 'oidc',
  createdAt: '2024-01-02T03:04:05Z',
}

const node = {
  id: '42',
  name: 'laptop',
  givenName: 'alice-laptop',
  machineKey: 'mkey-abcdefghijklmnopqrstuvwxyz',
  nodeKey: 'nkey-abcdefghijklmnopqrstuvwxyz',
  discoKey: 'dkey-abcdefghijklmnopqrstuvwxyz',
  ipAddresses: ['100.64.0.2'],
  user,
  lastSeen: '2024-02-01T00:00:00Z',
  createdAt: '2024-01-02T03:04:05Z',
  registerMethod: 'REGISTER_METHOD_AUTH_KEY',
  online: true,
  tags: ['tag:lab'],
  approvedRoutes: ['10.0.0.0/8'],
  availableRoutes: ['10.0.0.0/8', '0.0.0.0/0'],
  subnetRoutes: ['10.0.0.0/8'],
}

export const defaultHandlers = [
  http.get('http://hs.example.com/version', () => {
    return HttpResponse.json({ version: '0.29.3', commit: 'abc' })
  }),
  http.get('http://hs.example.com/api/v1/health', () => {
    return HttpResponse.json({ databaseConnectivity: true })
  }),
  http.get('http://hs.example.com/api/v1/user', () => {
    return HttpResponse.json({ users: [user] })
  }),
  http.get('http://hs.example.com/api/v1/node', () => {
    return HttpResponse.json({ nodes: [node] })
  }),
  http.get('http://hs.example.com/api/v1/node/:nodeId', ({ params }) => {
    return HttpResponse.json({ node: { ...node, id: String(params.nodeId) } })
  }),
  http.get('http://hs.example.com/api/v1/preauthkey', () => {
    return HttpResponse.json({
      preAuthKeys: [
        {
          id: '9',
          user,
          key: 'hskey-abcdefghijklmnopqrstuvwxyz',
          reusable: false,
          ephemeral: false,
          used: false,
          createdAt: '2024-01-01T00:00:00Z',
          expiration: '2024-12-01T00:00:00Z',
          aclTags: [],
        },
      ],
    })
  }),
]
