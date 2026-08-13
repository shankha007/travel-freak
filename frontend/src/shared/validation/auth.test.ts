import { describe, expect, it } from 'vitest'
import {
  MIN_PASSWORD_LENGTH,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
} from './auth'

describe('forgotPasswordSchema', () => {
  it('accepts an address', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'me@example.com' }).success).toBe(true)
  })

  it('rejects anything that is not one', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'me@' }).success).toBe(false)
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  const long = 'a'.repeat(MIN_PASSWORD_LENGTH)

  it('accepts a long enough password that matches its confirmation', () => {
    expect(resetPasswordSchema.safeParse({ password: long, confirmPassword: long }).success).toBe(
      true
    )
  })

  it('holds a new password to the sign-up minimum, not the sign-in one', () => {
    // A six-character password still signs in — existing accounts predate the
    // rule — but may not be chosen here.
    const short = 'a'.repeat(6)
    expect(signInSchema.safeParse({ email: 'me@example.com', password: short }).success).toBe(true)
    expect(resetPasswordSchema.safeParse({ password: short, confirmPassword: short }).success).toBe(
      false
    )
  })

  it('reports a mismatch against the confirmation field', () => {
    const result = resetPasswordSchema.safeParse({
      password: long,
      confirmPassword: `${long}x`,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it('rejects a password bcrypt would silently truncate', () => {
    const tooLong = 'a'.repeat(73)
    expect(
      resetPasswordSchema.safeParse({ password: tooLong, confirmPassword: tooLong }).success
    ).toBe(false)
  })
})
