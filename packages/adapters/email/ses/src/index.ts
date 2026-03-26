import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import type { EmailAdapter, SendEmailOptions } from '@fortis/core'

export interface SESAdapterConfig {
  region: string
  defaultFrom?: string
}

export function sesAdapter(config: SESAdapterConfig): EmailAdapter {
  const client = new SESClient({ region: config.region })

  return {
    async send({ to, subject, html, text, from }: SendEmailOptions) {
      const source = from ?? config.defaultFrom
      if (!source) throw new Error('SES adapter: from address is required')

      await client.send(new SendEmailCommand({
        Source: source,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: {
            Html: { Data: html },
            ...(text ? { Text: { Data: text } } : {}),
          },
        },
      }))
    },
  }
}
