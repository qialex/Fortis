import type { User } from '../adapters/database'

export interface FortisHooks {
  beforeRegister?: (opts: { email: string; password: string }) => Promise<void>
  afterRegister?: (opts: { user: User }) => Promise<void>
  beforeLogin?: (opts: { email: string }) => Promise<void>
  afterLogin?: (opts: { user: User; sessionId: string }) => Promise<void>
  beforeLogout?: (opts: { userId: string; sessionId: string }) => Promise<void>
  afterLogout?: (opts: { userId: string }) => Promise<void>
  beforePasswordReset?: (opts: { email: string }) => Promise<void>
  afterPasswordReset?: (opts: { userId: string }) => Promise<void>
}
