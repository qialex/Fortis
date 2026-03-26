import { describe, it, expect } from 'vitest'
import { signAccessToken, verifyAccessToken } from '../src/jwt'
import { hashPassword, verifyPassword, validatePasswordStrength } from '../src/password'
import { generateRefreshToken, isTokenExpired, refreshTokenExpiresAt } from '../src/tokens'
import { UnauthorizedError, ValidationError, RateLimitError } from '../src/errors'

const jwtConfig = {
  secret: 'test-secret-min-32-chars-long-enough',
  accessTokenTTL: '15m',
  refreshTokenTTL: '30d',
}

describe('JWT', () => {
  it('signs and verifies a token', () => {
    const token = signAccessToken(
      { sub: 'user-1', email: 'test@test.com', sessionId: 'session-1' },
      jwtConfig
    )
    const payload = verifyAccessToken(token, jwtConfig)
    expect(payload.sub).toBe('user-1')
    expect(payload.email).toBe('test@test.com')
  })

  it('throws on invalid token', () => {
    expect(() => verifyAccessToken('bad-token', jwtConfig)).toThrow(UnauthorizedError)
  })

  it('throws on tampered token', () => {
    const token = signAccessToken(
      { sub: 'user-1', email: 'test@test.com', sessionId: 'session-1' },
      jwtConfig
    )
    expect(() =>
      verifyAccessToken(token + 'tampered', jwtConfig)
    ).toThrow(UnauthorizedError)
  })
})

describe('Password', () => {
  it('hashes and verifies correctly', async () => {
    const hash = await hashPassword('my-secure-password')
    expect(await verifyPassword('my-secure-password', hash)).toBe(true)
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('validates password strength', () => {
    expect(validatePasswordStrength('short').valid).toBe(false)
    expect(validatePasswordStrength('long-enough-password').valid).toBe(true)
    expect(validatePasswordStrength('a'.repeat(129)).valid).toBe(false)
  })
})

describe('Tokens', () => {
  it('generates unique refresh tokens', () => {
    const a = generateRefreshToken()
    const b = generateRefreshToken()
    expect(a).not.toBe(b)
    expect(a.length).toBe(128)
  })

  it('correctly identifies expired tokens', () => {
    expect(isTokenExpired(Date.now() - 1000)).toBe(true)
    expect(isTokenExpired(Date.now() + 1000)).toBe(false)
  })

  it('generates future expiry', () => {
    const exp = refreshTokenExpiresAt(30)
    expect(exp).toBeGreaterThan(Date.now())
  })
})
