import {
  createFortis,
  hashPassword,
  validatePasswordStrength,
  UnauthorizedError,
  ValidationError,
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
    const { token, password } = JSON.parse(event.body ?? '{}')
    if (!token || !password) throw new ValidationError('token and password are required')

    const strength = validatePasswordStrength(password)
    if (!strength.valid) throw new ValidationError(strength.reason!)

    const record = await fortis.config.db.getEmailToken(token, 'reset')
    if (!record) throw new UnauthorizedError('Invalid or expired reset token')
    if (record.expiresAt < Date.now()) {
      await fortis.config.db.deleteEmailToken(token)
      throw new UnauthorizedError('Reset token expired')
    }

    const passwordHash = await hashPassword(password)
    await fortis.config.db.updateUser(record.userId, { passwordHash })
    await fortis.config.db.deleteEmailToken(token)

    // invalidate all sessions on password reset
    await fortis.config.db.deleteAllRefreshTokens(record.userId)

    await fortis.config.hooks?.afterPasswordReset?.({ userId: record.userId })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Password reset successful. Please log in.' }),
    }
  } catch (err: any) {
    return {
      statusCode: err.statusCode ?? 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
