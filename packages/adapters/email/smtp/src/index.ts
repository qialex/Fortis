import nodemailer from 'nodemailer'
import type { EmailAdapter, SendEmailOptions } from '@fortis/core'

export interface SMTPAdapterConfig {
  host: string
  port: number
  auth: {
    user: string
    pass: string
  }
  secure?: boolean
  defaultFrom?: string
}

export function smtpAdapter(config: SMTPAdapterConfig): EmailAdapter {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure ?? config.port === 465,
    auth: config.auth,
  })

  return {
    async send({ to, subject, html, text, from }: SendEmailOptions) {
      await transporter.sendMail({
        from: from ?? config.defaultFrom,
        to,
        subject,
        html,
        text,
      })
    },
  }
}
