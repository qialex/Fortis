import {
  createFortis,
  signAccessToken,
  verifyPassword,
  generateRefreshToken,
  generateSessionId,
  refreshTokenExpiresAt,
  checkRateLimit,
  resetRateLimit,
  rateLimitKey,
  UnauthorizedError,
  ValidationError,
} from '@fortis/core'
import { dynamodbAdapter } from '@fortis/adapter-dynamodb'
import { sesAdapter } from '@fortis/adapter-ses'

const fortis = createFortis({
  db: dynamodbAdapter({
    usersTable: process.env.USERS_TABLE!,
    tokensTable: process.env.TOKENS_TABLE!,
    // Both tables are local — users is a Global Table replica, tokens is regional
    region: process.env.AWS_REGION!,
    // Writes to users table go to primary to prevent duplicate email race conditions
    usersWriteRegion: process.env.PRIMARY_REGION ?? 'us-east-1',
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

    const ip = event.requestContext?.identity?.sourceIp ?? 'unknown'
    const rlKey = rateLimitKey('login', `${email}:${ip}`)

    await checkRateLimit(fortis.config.db, rlKey, { maxAttempts: 5 })

    const user = await fortis.config.db.getUserByEmail(email.toLowerCase())
    if (!user) throw new UnauthorizedError('Invalid credentials')

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) throw new UnauthorizedError('Invalid credentials')

    if (user.status === 'banned') throw new UnauthorizedError('Account suspended')
    if (user.status === 'unverified') throw new UnauthorizedError('Please verify your email')

    await resetRateLimit(fortis.config.db, rlKey)

    const sessionId = generateSessionId()
    const refreshToken = generateRefreshToken()

    await fortis.config.db.createRefreshToken({
      token: refreshToken,
      userId: user.userId,
      sessionId,
      userAgent: event.headers?.['user-agent'],
      ip,
      expiresAt: refreshTokenExpiresAt(30),
      createdAt: Date.now(),
    })

    const accessToken = signAccessToken(
      { sub: user.userId, email: user.email, sessionId },
      fortis.config.jwt
    )

    await fortis.config.hooks?.afterLogin?.({ user, sessionId })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        refreshToken,
        user: { userId: user.userId, email: user.email },
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
