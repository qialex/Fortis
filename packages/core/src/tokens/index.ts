import crypto from 'crypto'

export interface RefreshToken {
  token: string
  userId: string
  sessionId: string
  userAgent?: string
  ip?: string
  expiresAt: number
  createdAt: number
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex')
}

export function generateSessionId(): string {
  return crypto.randomUUID()
}

export function isTokenExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt
}

export function refreshTokenExpiresAt(ttlDays = 30): number {
  return Date.now() + ttlDays * 24 * 60 * 60 * 1000
}
