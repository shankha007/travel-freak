import { describe, expect, it } from 'vitest'
import { ALL_COUNTRIES } from './countries'
import { CONTINENTS, allMappedCountries, continentOf } from './continents'

/**
 * The table is hand-written, so these are the tests that keep it honest.
 *
 * Full coverage matters more than it looks: `continentOf` returns null for an
 * unknown code, and the map filter treats null as "cannot say" — so a country
 * missing from the table would quietly disappear from its owner's own map the
 * moment they picked a continent.
 */
describe('the continent table', () => {
  it('covers every country the app can record a trip to', () => {
    const missing = ALL_COUNTRIES.map((c) => c.code).filter((code) => continentOf(code) === null)

    expect(missing).toEqual([])
  })

  it('claims no country the app does not know about', () => {
    const known = new Set(ALL_COUNTRIES.map((c) => c.code))
    const strays = allMappedCountries().filter((code) => !known.has(code))

    expect(strays).toEqual([])
  })

  it('puts each country on exactly one continent', () => {
    const codes = allMappedCountries()

    expect(codes.length).toBe(new Set(codes).size)
  })

  it('places dependencies by geography, not by governance', () => {
    // The rule the file states, spelled out where a future edit would hit it.
    expect(continentOf('REU')).toBe('AF')
    expect(continentOf('GUF')).toBe('SA')
    expect(continentOf('GRL')).toBe('NA')
    expect(continentOf('HKG')).toBe('AS')
  })

  it('has no empty continent', () => {
    for (const continent of CONTINENTS) {
      expect(
        allMappedCountries().filter((c) => continentOf(c) === continent).length
      ).toBeGreaterThan(0)
    }
  })
})
