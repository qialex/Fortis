import type { DatabaseAdapter } from '../adapters/database'
import { RateLimitError } from '../errors'

export interface RateLimitConfig {
  maxAttempts: number   // default 5
  windowSeconds: number // default 900 (15 min)
}

const defaults: RateLimitConfig = {
  maxAttempts: 5,
  windowSeconds: 900,
}

export async function checkRateLimit(
  db: DatabaseAdapter,
  key: string,
  config: Partial<RateLimitConfig> = {}
): Promise<void> {
  const { maxAttempts } = { ...defaults, ...config }
  const attempts = await db.incrementLoginAttempts(key)
  if (attempts > maxAttempts) {
    throw new RateLimitError(
      `Too many attempts. Try again later.`
    )
  }
}

export async function resetRateLimit(
  db: DatabaseAdapter,
  key: string
): Promise<void> {
  await db.resetLoginAttempts(key)
}

export function rateLimitKey(type: 'login' | 'register' | 'reset', identifier: string): string {
  return `rl:${type}:${identifier}`
}
