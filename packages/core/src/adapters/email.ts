export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

export interface EmailAdapter {
  send(options: SendEmailOptions): Promise<void>
}

export interface EmailTemplates {
  verify: (opts: { url: string; email: string }) => { subject: string; html: string }
  reset: (opts: { url: string; email: string }) => { subject: string; html: string }
  magicLink: (opts: { url: string; email: string }) => { subject: string; html: string }
}
