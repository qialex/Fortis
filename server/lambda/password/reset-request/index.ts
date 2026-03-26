import crypto from 'crypto'
import { createFortis, checkRateLimit, rateLimitKey, ValidationError } from '@fortis/core'
import { dynamodbAdapter } from '@fortis/adapter-dynamodb'
import { sesAdapter } from '@fortis/adapter-ses'

const fortis = createFortis({
  db: dynamodbAdapter({
    usersTable: process.env.USERS_TABLE!,
    tokensTable: process.env.TOKENS_TABLE!,
    region: process.env.PRIMARY_REGION ?? 'us-east-1',
  }),
  email: sesAdapter({ region: process.env.PRIMARY_REGION ?? 'us-east-1' }),
  jwt: {
    secret: process.env.JWT_SECRET!,
    accessTokenTTL: '15m',
    refreshTokenTTL: '30d',
  },
})

export const handler = async (event: any) => {
  try {
    const { email } = JSON.parse(event.body ?? '{}')
    if (!email) throw new ValidationError('email is required')

    const ip = event.requestContext?.identity?.sourceIp ?? 'unknown'
    await checkRateLimit(fortis.config.db, rateLimitKey('reset', ip), {
      maxAttempts: 5,
      windowSeconds: 3600,
    })

    // always return 200 — never reveal whether email exists
    const user = await fortis.config.db.getUserByEmail(email.toLowerCase())
    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      await fortis.config.db.createEmailToken({
        token,
        userId: user.userId,
        email: user.email,
        type: 'reset',
        expiresAt: Date.now() + 60 * 60 * 1000, // 1h
      })

      const resetUrl = `${process.env.BASE_URL}/auth/password/confirm?token=${token}`
      await fortis.config.email.send({
        to: user.email,
        subject: 'Reset your password',
        html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
        from: process.env.FROM_EMAIL,
      })

      await fortis.config.hooks?.beforePasswordReset?.({ email })
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'If that email exists, a reset link has been sent.' }),
    }
  } catch (err: any) {
    return {
      statusCode: err.statusCode ?? 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
