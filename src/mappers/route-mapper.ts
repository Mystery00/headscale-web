import type { Node } from '@/domain/node'
import type { RouteView } from '@/domain/route'

export function isExitPrefix(prefix: string): boolean {
  return prefix === '0.0.0.0/0' || prefix === '::/0'
}

export function mapRoutesFromNodes(nodes: Node[]): RouteView[] {
  const routes: RouteView[] = []
  for (const node of nodes) {
    const prefixes = new Set([
      ...node.availableRoutes,
      ...node.approvedRoutes,
      ...node.subnetRoutes,
    ])
    for (const prefix of prefixes) {
      routes.push({
        id: `${node.id}:${prefix}`,
        nodeId: node.id,
        nodeName: node.givenName || node.name,
        userName: node.user.name,
        prefix,
        advertised: node.availableRoutes.includes(prefix),
        approved: node.approvedRoutes.includes(prefix),
        serving: node.subnetRoutes.includes(prefix),
        exitRoute: isExitPrefix(prefix),
      })
    }
  }
  return routes
}
