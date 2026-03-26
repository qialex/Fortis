import jwt from 'jsonwebtoken'
import { UnauthorizedError } from '../errors'

export interface JWTConfig {
  secret: string
  accessTokenTTL: string  // e.g. '15m'
  refreshTokenTTL: string // e.g. '30d'
  algorithm?: 'HS256' | 'RS256'
}

export interface AccessTokenPayload {
  sub: string        // userId
  email: string
  sessionId: string
  iat?: number
  exp?: number
}

export function signAccessToken(
  payload: Omit<AccessTokenPayload, 'iat' | 'exp'>,
  config: JWTConfig
): string {
  return jwt.sign(payload, config.secret, {
    expiresIn: config.accessTokenTTL,
    algorithm: config.algorithm ?? 'HS256',
  })
}

export function verifyAccessToken(
  token: string,
  config: JWTConfig
): AccessTokenPayload {
  try {
    return jwt.verify(token, config.secret, {
      algorithms: [config.algorithm ?? 'HS256'],
    }) as AccessTokenPayload
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired token')
  }
}

export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.decode(token) as AccessTokenPayload
  } catch {
    return null
  }
}
