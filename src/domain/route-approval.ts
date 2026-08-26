import type { Node } from '@/domain/node'
import { isExitPrefix } from '@/mappers/route-mapper'

const EXIT_PREFIXES = ['0.0.0.0/0', '::/0'] as const

export function nextApprovedRoutes(node: Node, prefix: string, approved: boolean): string[] {
  const current = new Set(node.approvedRoutes)
  const targets = isExitPrefix(prefix) ? EXIT_PREFIXES : [prefix]
  for (const item of targets) {
    if (approved) current.add(item)
    else current.delete(item)
  }
  return [...current]
}
