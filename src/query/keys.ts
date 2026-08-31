export const queryKeys = {
  systemVersion: ['system', 'version'] as const,
  systemHealth: ['system', 'health'] as const,
  users: (filters?: { id?: string; name?: string; email?: string }) =>
    ['users', filters ?? {}] as const,
  nodes: (filters?: { userName?: string }) => ['nodes', filters ?? {}] as const,
  node: (nodeId: string) => ['node', nodeId] as const,
  preAuthKeys: ['preAuthKeys'] as const,
  apiKeyStatus: ['apiKeyStatus'] as const,
}
