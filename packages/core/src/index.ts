import type { DatabaseAdapter } from './adapters/database'
import type { EmailAdapter } from './adapters/email'
import type { FortisHooks } from './hooks'
import type { WebhookConfig } from './webhooks'
import type { JWTConfig } from './jwt'

export interface FortisConfig {
  db: DatabaseAdapter
  email: EmailAdapter
  jwt: JWTConfig
  hooks?: FortisHooks
  webhooks?: WebhookConfig
  baseUrl?: string         // for email links, e.g. https://yourapp.com
  fromEmail?: string       // default sender, e.g. auth@yourapp.com
}

export interface FortisInstance {
  config: FortisConfig
}

export function createFortis(config: FortisConfig): FortisInstance {
  if (!config.db) throw new Error('Fortis: db adapter is required')
  if (!config.email) throw new Error('Fortis: email adapter is required')
  if (!config.jwt?.secret) throw new Error('Fortis: jwt.secret is required')

  return { config }
}

// Re-export everything consumers need
export * from './jwt'
export * from './password'
export * from './tokens'
export * from './errors'
export * from './hooks'
export * from './webhooks'
export * from './rate-limiting'
export * from './adapters/database'
export * from './adapters/email'
