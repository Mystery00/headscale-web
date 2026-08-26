import type { PreAuthKey } from '@/domain/preauth-key'

export interface CreatePreAuthKeyInput {
  userId: string
  reusable: boolean
  ephemeral: boolean
  expiration: Date | null
  aclTags: string[]
}

export interface CreatedPreAuthKey {
  record: PreAuthKey
  plaintext: string
}
