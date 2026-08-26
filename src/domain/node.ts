import type { PreAuthKeySummary } from '@/domain/preauth-key'
import type { RegisterMethod } from '@/domain/register-method'
import type { User } from '@/domain/user'

export interface Node {
  id: string
  name: string
  givenName: string
  machineKey: string
  nodeKey: string
  discoKey: string
  ipAddresses: string[]
  user: User
  lastSeen: Date | null
  expiry: Date | null
  createdAt: Date
  registerMethod: RegisterMethod
  online: boolean
  tags: string[]
  approvedRoutes: string[]
  availableRoutes: string[]
  subnetRoutes: string[]
  preAuthKey: PreAuthKeySummary | null
}
