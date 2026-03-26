import {
  verifyAccessToken,
  UnauthorizedError,
  createFortis,
} from '@fortis/core'
import { dynamodbAdapter } from '@fortis/adapter-dynamodb'
import { sesAdapter } from '@fortis/adapter-ses'

const fortis = createFortis({
  db: dynamodbAdapter({
    usersTable: process.env.USERS_TABLE!,
    tokensTable: process.env.TOKENS_TABLE!,
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
    const authHeader = event.headers?.Authorization ?? event.headers?.authorization
    if (!authHeader) throw new UnauthorizedError('Authorization header required')

    const accessToken = authHeader.replace('Bearer ', '')
    const payload = verifyAccessToken(accessToken, fortis.config.jwt)

    await fortis.config.hooks?.beforeLogout?.({
      userId: payload.sub,
      sessionId: payload.sessionId,
    })

    if (refreshToken) {
      await fortis.config.db.deleteRefreshToken(refreshToken)
    }

    await fortis.config.hooks?.afterLogout?.({ userId: payload.sub })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Logged out' }),
    }
  } catch (err: any) {
    return {
      statusCode: err.statusCode ?? 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
