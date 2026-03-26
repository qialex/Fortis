import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  generateSessionId,
  refreshTokenExpiresAt,
  isTokenExpired,
  UnauthorizedError,
} from '@fortis/core'
import { dynamodbAdapter } from '@fortis/adapter-dynamodb'
import { sesAdapter } from '@fortis/adapter-ses'
import { createFortis } from '@fortis/core'

// lean config — tokens table is LOCAL to this region for fast reads
const fortis = createFortis({
  db: dynamodbAdapter({
    usersTable: process.env.USERS_TABLE!,
    tokensTable: process.env.TOKENS_TABLE!, // regional table
    region: process.env.AWS_REGION!,
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
    const { refreshToken } = JSON.parse(event.body ?? '{}')
    if (!refreshToken) throw new UnauthorizedError('refreshToken is required')

    // local DynamoDB read — fast
    const stored = await fortis.config.db.getRefreshToken(refreshToken)
    if (!stored) throw new UnauthorizedError('Invalid refresh token')
    if (isTokenExpired(stored.expiresAt)) {
      await fortis.config.db.deleteRefreshToken(refreshToken)
      throw new UnauthorizedError('Refresh token expired')
    }

    // rotate: delete old, issue new
    await fortis.config.db.deleteRefreshToken(refreshToken)

    const newSessionId = generateSessionId()
    const newRefreshToken = generateRefreshToken()

    await fortis.config.db.createRefreshToken({
      token: newRefreshToken,
      userId: stored.userId,
      sessionId: newSessionId,
      userAgent: event.headers?.['user-agent'],
      ip: event.requestContext?.identity?.sourceIp,
      expiresAt: refreshTokenExpiresAt(30),
      createdAt: Date.now(),
    })

    const accessToken = signAccessToken(
      { sub: stored.userId, email: '', sessionId: newSessionId },
      fortis.config.jwt
    )

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, refreshToken: newRefreshToken }),
    }
  } catch (err: any) {
    return {
      statusCode: err.statusCode ?? 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
