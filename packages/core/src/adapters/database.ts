import type { RefreshToken } from '../tokens'

export interface User {
  userId: string
  email: string
  passwordHash: string
  emailVerified: boolean
  status: 'active' | 'banned' | 'unverified'
  createdAt: number
  updatedAt: number
}

export interface DatabaseAdapter {
  // Users
  createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>
  getUserByEmail(email: string): Promise<User | null>
  getUserById(userId: string): Promise<User | null>
  updateUser(userId: string, data: Partial<User>): Promise<User>
  deleteUser(userId: string): Promise<void>
  listUsers(opts?: { limit?: number; cursor?: string }): Promise<{
    users: User[]
    cursor?: string
  }>

  // Refresh tokens
  createRefreshToken(token: RefreshToken): Promise<void>
  getRefreshToken(token: string): Promise<RefreshToken | null>
  deleteRefreshToken(token: string): Promise<void>
  deleteAllRefreshTokens(userId: string): Promise<void>
  listRefreshTokens(userId: string): Promise<RefreshToken[]>

  // Email tokens (verify + reset)
  createEmailToken(opts: {
    token: string
    userId: string
    email: string
    type: 'verify' | 'reset'
    expiresAt: number
  }): Promise<void>
  getEmailToken(token: string, type: 'verify' | 'reset'): Promise<{
    userId: string
    email: string
    expiresAt: number
  } | null>
  deleteEmailToken(token: string): Promise<void>

  // Rate limiting
  incrementLoginAttempts(key: string): Promise<number>
  resetLoginAttempts(key: string): Promise<void>
}
