import type { DatabaseAdapter, User } from '@fortis/core'
import type { RefreshToken } from '@fortis/core'

export function mockDatabaseAdapter(): DatabaseAdapter {
  const users = new Map<string, User>()
  const usersByEmail = new Map<string, User>()
  const tokens = new Map<string, RefreshToken>()
  const emailTokens = new Map<string, any>()
  const rateLimits = new Map<string, number>()

  return {
    async createUser(data) {
      const now = Date.now()
      const user: User = { ...data, createdAt: now, updatedAt: now }
      users.set(user.userId, user)
      usersByEmail.set(user.email, user)
      return user
    },
    async getUserByEmail(email) {
      return usersByEmail.get(email) ?? null
    },
    async getUserById(userId) {
      return users.get(userId) ?? null
    },
    async updateUser(userId, data) {
      const user = users.get(userId)
      if (!user) throw new Error('User not found')
      const updated = { ...user, ...data, updatedAt: Date.now() }
      users.set(userId, updated)
      usersByEmail.set(updated.email, updated)
      return updated
    },
    async deleteUser(userId) {
      const user = users.get(userId)
      if (user) usersByEmail.delete(user.email)
      users.delete(userId)
    },
    async listUsers() {
      return { users: Array.from(users.values()) }
    },
    async createRefreshToken(token) {
      tokens.set(token.token, token)
    },
    async getRefreshToken(token) {
      return tokens.get(token) ?? null
    },
    async deleteRefreshToken(token) {
      tokens.delete(token)
    },
    async deleteAllRefreshTokens(userId) {
      for (const [key, t] of tokens) {
        if (t.userId === userId) tokens.delete(key)
      }
    },
    async listRefreshTokens(userId) {
      return Array.from(tokens.values()).filter(t => t.userId === userId)
    },
    async createEmailToken(opts) {
      emailTokens.set(opts.token, opts)
    },
    async getEmailToken(token) {
      const t = emailTokens.get(token)
      if (!t) return null
      return { userId: t.userId, email: t.email, expiresAt: t.expiresAt }
    },
    async deleteEmailToken(token) {
      emailTokens.delete(token)
    },
    async incrementLoginAttempts(key) {
      const count = (rateLimits.get(key) ?? 0) + 1
      rateLimits.set(key, count)
      return count
    },
    async resetLoginAttempts(key) {
      rateLimits.delete(key)
    },
  }
}

export function mockEmailAdapter() {
  const sent: any[] = []
  return {
    sent,
    async send(opts: any) {
      sent.push(opts)
    },
  }
}
