import bcrypt from 'bcryptjs'

const COST_FACTOR = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST_FACTOR)
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function validatePasswordStrength(password: string): {
  valid: boolean
  reason?: string
} {
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters' }
  }
  if (password.length > 128) {
    return { valid: false, reason: 'Password must be under 128 characters' }
  }
  return { valid: true }
}
