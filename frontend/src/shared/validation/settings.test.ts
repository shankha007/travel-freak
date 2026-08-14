import { describe, expect, it } from 'vitest'
import {
  MAX_INTERESTS,
  changeEmailSchema,
  changePasswordSchema,
  parseInterests,
  privacySettingsSchema,
  profileSettingsSchema,
} from './settings'

describe('parseInterests', () => {
  it('splits on commas and trims what is left', () => {
    expect(parseInterests(' hiking , street food ,trains ')).toEqual([
      'hiking',
      'street food',
      'trains',
    ])
  })

  it('drops the empties a trailing comma leaves behind', () => {
    expect(parseInterests('hiking,,trains,')).toEqual(['hiking', 'trains'])
    expect(parseInterests('   ')).toEqual([])
  })

  it('collapses runs of whitespace inside an interest', () => {
    expect(parseInterests('street    food')).toEqual(['street food'])
  })

  it('keeps the first spelling of a duplicate and drops the rest', () => {
    // Case is the writer's business; saying the same thing twice is not.
    expect(parseInterests('Hiking, hiking, HIKING')).toEqual(['Hiking'])
  })

  it('stops at the cap rather than handing the column too many', () => {
    const many = Array.from({ length: MAX_INTERESTS + 5 }, (_, i) => `thing${i}`).join(',')
    expect(parseInterests(many)).toHaveLength(MAX_INTERESTS)
  })

  it('truncates one that is too long instead of rejecting the whole field', () => {
    const long = 'a'.repeat(60)
    expect(parseInterests(long)[0]).toHaveLength(30)
  })
})

describe('profileSettingsSchema', () => {
  const valid = {
    username: 'ada',
    displayName: 'Ada',
    bio: 'Counts things.',
    countryCode: 'IND',
    city: 'Kolkata',
    interests: ['hiking'],
  }

  it('accepts an ordinary profile', () => {
    expect(profileSettingsSchema.safeParse(valid).success).toBe(true)
  })

  it('holds a renamed username to the same rules onboarding does', () => {
    // Including the reserved list — this screen must not be a second door to
    // /u/admin just because it has its own form.
    expect(profileSettingsSchema.safeParse({ ...valid, username: 'admin' }).success).toBe(false)
    expect(profileSettingsSchema.safeParse({ ...valid, username: 'Ada' }).success).toBe(true)
    expect(profileSettingsSchema.safeParse({ ...valid, username: 'a b' }).success).toBe(false)
    expect(profileSettingsSchema.safeParse({ ...valid, username: 'ab' }).success).toBe(false)
  })

  it('lower-cases the username it accepts, matching the column', () => {
    const parsed = profileSettingsSchema.parse({ ...valid, username: 'ADA_99' })
    expect(parsed.username).toBe('ada_99')
  })

  it('turns a blank country into null rather than an empty code', () => {
    expect(profileSettingsSchema.parse({ ...valid, countryCode: '' }).countryCode).toBeNull()
  })

  it('refuses a country that is not one', () => {
    expect(profileSettingsSchema.safeParse({ ...valid, countryCode: 'XXX' }).success).toBe(false)
  })
})

describe('privacySettingsSchema', () => {
  it('takes only the three the enum has', () => {
    expect(
      privacySettingsSchema.safeParse({ isPublic: true, defaultTripVisibility: 'unlisted' }).success
    ).toBe(true)
    expect(
      privacySettingsSchema.safeParse({ isPublic: true, defaultTripVisibility: 'friends' }).success
    ).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  const long = 'a'.repeat(12)

  it('accepts a change', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'whatever',
        newPassword: long,
        confirmPassword: long,
      }).success
    ).toBe(true)
  })

  it('reports a mismatch against the confirmation', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'whatever',
      newPassword: long,
      confirmPassword: `${long}x`,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it('refuses a password bcrypt would silently truncate', () => {
    const tooLong = 'a'.repeat(73)
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'whatever',
        newPassword: tooLong,
        confirmPassword: tooLong,
      }).success
    ).toBe(false)
  })

  it('does not accept the password already in use as a change', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: long,
      newPassword: long,
      confirmPassword: long,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['newPassword'])
  })

  it('does not hold the current password to today’s minimum', () => {
    // An account older than the rule still has to be able to get out of it.
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'six666',
        newPassword: long,
        confirmPassword: long,
      }).success
    ).toBe(true)
  })
})

describe('changeEmailSchema', () => {
  it('needs an address that could receive the confirmation', () => {
    expect(changeEmailSchema.safeParse({ email: 'ada@example.com' }).success).toBe(true)
    expect(changeEmailSchema.safeParse({ email: 'ada@' }).success).toBe(false)
  })
})
