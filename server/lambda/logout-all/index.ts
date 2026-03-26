import {
  verifyAccessToken,
  UnauthorizedError,
  createFortis,
} from '@fortis/core'
import { dynamodbAdapter } from '@fortis/adapter-dynamodb'
import { sesAdapter } from '@fortis/adapter-ses'

// One adapter per regional tokens table
const regions = [
  { name: 'us-east-1', table: process.env.TOKENS_TABLE_US! },
  { name: 'eu-west-2', table: process.env.TOKENS_TABLE_UK! },
  { name: 'ap-southeast-2', table: process.env.TOKENS_TABLE_AU! },
].filter(r => r.table)

const primaryDb = dynamodbAdapter({
  usersTable: process.env.USERS_TABLE!,
  tokensTable: process.env.TOKENS_TABLE!,
  region: process.env.AWS_REGION!,
})

const fortis = createFortis({
  db: primaryDb,
  email: sesAdapter({ region: process.env.PRIMARY_REGION ?? 'us-east-1' }),
  jwt: {
    secret: process.env.JWT_SECRET!,
    accessTokenTTL: '15m',
    refreshTokenTTL: '30d',
  },
})

export const handler = async (event: any) => {
  try {
    const authHeader = event.headers?.Authorization ?? event.headers?.authorization
    if (!authHeader) throw new UnauthorizedError('Authorization header required')

    const accessToken = authHeader.replace('Bearer ', '')
    const payload = verifyAccessToken(accessToken, fortis.config.jwt)

    // fan out to all regional token tables in parallel
    await Promise.all(
      regions.map(region => {
        const db = dynamodbAdapter({
          usersTable: process.env.USERS_TABLE!,
          tokensTable: region.table,
          region: region.name,
        })
        return db.deleteAllRefreshTokens(payload.sub)
      })
    )

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'All sessions terminated' }),
    }
  } catch (err: any) {
    return {
      statusCode: err.statusCode ?? 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
