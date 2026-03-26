import type { EmailAdapter, SendEmailOptions } from '@fortis/core'

export interface ResendAdapterConfig {
  apiKey: string
  defaultFrom?: string
}

export function resendAdapter(config: ResendAdapterConfig): EmailAdapter {
  return {
    async send({ to, subject, html, text, from }: SendEmailOptions) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from ?? config.defaultFrom,
          to,
          subject,
          html,
          text,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(`Resend error: ${err.message}`)
      }
    },
  }
}
