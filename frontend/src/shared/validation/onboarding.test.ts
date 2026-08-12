import { describe, expect, it } from 'vitest'
import {
  onboardingProfileSchema,
  suggestUsername,
  usernameSchema,
  visitedCountriesSchema,
} from './onboarding'

describe('usernameSchema', () => {
  it('accepts what the database accepts', () => {
    expect(usernameSchema.safeParse('shankha_07').success).toBe(true)
    expect(usernameSchema.safeParse('abc').success).toBe(true)
  })

  it('lowercases rather than rejecting, since the column is citext', () => {
    expect(usernameSchema.parse('  Shankha  ')).toBe('shankha')
  })

  it('mirrors the length bounds of the CHECK constraint', () => {
    // Accepting something the constraint rejects means a 500, not a field error.
    expect(usernameSchema.safeParse('ab').success).toBe(false)
    expect(usernameSchema.safeParse('a'.repeat(31)).success).toBe(false)
    expect(usernameSchema.safeParse('a'.repeat(30)).success).toBe(true)
  })

  it('rejects characters the constraint would reject', () => {
    expect(usernameSchema.safeParse('with space').success).toBe(false)
    expect(usernameSchema.safeParse('with-hyphen').success).toBe(false)
    expect(usernameSchema.safeParse('émigré').success).toBe(false)
  })

  it('refuses names the product needs for its own URLs', () => {
    // /u/settings must not be someone's profile.
    expect(usernameSchema.safeParse('settings').success).toBe(false)
    expect(usernameSchema.safeParse('admin').success).toBe(false)
    expect(usernameSchema.safeParse('changelog').success).toBe(false)
  })
})

describe('onboardingProfileSchema', () => {
  const valid = { username: 'traveller1', displayName: 'A Traveller', countryCode: 'IND', city: '' }

  it('accepts a filled-in profile', () => {
    expect(onboardingProfileSchema.safeParse(valid).success).toBe(true)
  })

  it('treats an unanswered home country as null, not invalid', () => {
    const result = onboardingProfileSchema.safeParse({ ...valid, countryCode: '' })
    expect(result.success).toBe(true)
    expect(result.data?.countryCode).toBeNull()
  })

  it('rejects a country code that is not a country', () => {
    expect(onboardingProfileSchema.safeParse({ ...valid, countryCode: 'ZZZ' }).success).toBe(false)
  })
})

describe('visitedCountriesSchema', () => {
  it('accepts a list of codes', () => {
    expect(visitedCountriesSchema.parse(['IND', 'JPN', 'NPL'])).toEqual(['IND', 'JPN', 'NPL'])
  })

  it('collapses duplicates rather than failing the whole step', () => {
    expect(visitedCountriesSchema.parse(['IND', 'IND', 'JPN'])).toEqual(['IND', 'JPN'])
  })

  it('accepts an empty list — skipping the step is allowed', () => {
    expect(visitedCountriesSchema.parse([])).toEqual([])
  })

  it('rejects an unknown code', () => {
    expect(visitedCountriesSchema.safeParse(['IND', 'ZZZ']).success).toBe(false)
  })

  it('rejects more codes than there are countries', () => {
    expect(visitedCountriesSchema.safeParse(Array(301).fill('IND')).success).toBe(false)
  })
})

describe('suggestUsername', () => {
  it('derives from the local part of an email, like handle_new_user does', () => {
    expect(suggestUsername('shankhasdas07@gmail.com')).toBe('shankhasdas07')
  })

  it('strips what the constraint would reject', () => {
    expect(suggestUsername('first.last@example.com')).toBe('firstlast')
    expect(suggestUsername('José Álvarez')).toBe('josealvarez')
  })

  it('falls back rather than returning something too short', () => {
    expect(suggestUsername('a@b.com')).toBe('traveller')
    expect(suggestUsername('!!!')).toBe('traveller')
  })

  it('produces something the schema accepts', () => {
    for (const source of ['shankhasdas07@gmail.com', 'a@b.com', 'José Álvarez', '...']) {
      expect(usernameSchema.safeParse(suggestUsername(source)).success).toBe(true)
    }
  })
})
