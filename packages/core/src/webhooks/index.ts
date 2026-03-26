import crypto from 'crypto'

export type WebhookEvent =
  | 'user.created'
  | 'user.deleted'
  | 'user.login'
  | 'user.logout'
  | 'user.banned'
  | 'password.reset'
  | 'email.verified'

export interface WebhookConfig {
  url: string
  secret: string
  events: WebhookEvent[]
}

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: number
  data: Record<string, unknown>
}

function sign(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

export async function dispatchWebhook(
  config: WebhookConfig,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  if (!config.events.includes(event)) return

  const payload: WebhookPayload = {
    event,
    timestamp: Date.now(),
    data,
  }

  const body = JSON.stringify(payload)
  const signature = sign(body, config.secret)

  await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-fortis-signature': signature,
      'x-fortis-timestamp': String(payload.timestamp),
    },
    body,
  })
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expected = sign(body, secret)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}
