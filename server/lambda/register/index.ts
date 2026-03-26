import crypto from 'crypto'
import {
  createFortis,
  hashPassword,
  validatePasswordStrength,
  checkRateLimit,
  rateLimitKey,
  ValidationError,
  ConflictError,
} from '@fortis/core'
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
    const { email, password } = JSON.parse(event.body ?? '{}')

    if (!email || !password) {
      throw new ValidationError('email and password are required')
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError('Invalid email address')
    }

    const strength = validatePasswordStrength(password)
    if (!strength.valid) throw new ValidationError(strength.reason!)

    const ip = event.requestContext?.identity?.sourceIp ?? 'unknown'
    await checkRateLimit(fortis.config.db, rateLimitKey('register', ip), {
      maxAttempts: 10,
      windowSeconds: 3600,
    })

    await fortis.config.hooks?.beforeRegister?.({ email, password })

    const existing = await fortis.config.db.getUserByEmail(email.toLowerCase())
    if (existing) throw new ConflictError('Email already registered')

    const passwordHash = await hashPassword(password)
    const userId = crypto.randomUUID()

    const user = await fortis.config.db.createUser({
      userId,
      email: email.toLowerCase(),
      passwordHash,
      emailVerified: false,
      status: 'unverified',
    })

    // create email verification token
    const verifyToken = crypto.randomBytes(32).toString('hex')
    await fortis.config.db.createEmailToken({
      token: verifyToken,
      userId: user.userId,
      email: user.email,
      type: 'verify',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
    })

    const verifyUrl = `${process.env.BASE_URL}/auth/email/confirm?token=${verifyToken}`
    await fortis.config.email.send({
      to: user.email,
      subject: 'Verify your email',
      html: `<p>Click <a href="${verifyUrl}">here</a> to verify your email. Link expires in 24 hours.</p>`,
      from: process.env.FROM_EMAIL,
    })

    await fortis.config.hooks?.afterRegister?.({ user })

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Account created. Please verify your email.',
        userId: user.userId,
      }),
    }
  } catch (err: any) {
    return {
      statusCode: err.statusCode ?? 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
