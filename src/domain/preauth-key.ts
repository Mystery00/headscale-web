import type { User } from '@/domain/user'

export interface PreAuthKeySummary {
  id: string
  keyPreview: string | null
}

export type PreAuthKeyState = 'active' | 'used' | 'expired'

export interface PreAuthKey {
  id: string
  user: User | null
  keyPreview: string | null
  reusable: boolean
  ephemeral: boolean
  used: boolean
  expiration: Date | null
  createdAt: Date
  aclTags: string[]
  state: PreAuthKeyState
}
