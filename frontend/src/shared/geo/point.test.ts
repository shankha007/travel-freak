import { describe, expect, it } from 'vitest'
import { formatLngLat, isValidLngLat, pointFrom, toPointEwkt } from './point'

describe('pointFrom', () => {
  it('reads the generated columns', () => {
    expect(pointFrom(28.6129, 77.2295)).toEqual({ lng: 77.2295, lat: 28.6129 })
  })

  it('treats a missing coordinate as no pin', () => {
    // Both columns are generated from the same geography, so in practice they are
    // null together — but half a pin is never a location.
    expect(pointFrom(null, null)).toBeNull()
    expect(pointFrom(28.6129, null)).toBeNull()
    expect(pointFrom(null, 77.2295)).toBeNull()
    expect(pointFrom(undefined, undefined)).toBeNull()
  })

  it('rejects coordinates that are not on the earth', () => {
    expect(pointFrom(28, 200)).toBeNull()
    expect(pointFrom(91, 77)).toBeNull()
  })

  it('does not accept a stringified number, which is what a hex column would give', () => {
    // PostgREST serialises `location` itself as hex EWKB. Reading that column by
    // mistake must fail loudly-ish (no pin) rather than half-work.
    expect(pointFrom('28.6' as unknown as number, '77.2' as unknown as number)).toBeNull()
  })
})

describe('toPointEwkt', () => {
  it('writes EWKT with the SRID spelled out', () => {
    expect(toPointEwkt({ lng: 77.2295, lat: 28.6129 })).toBe('SRID=4326;POINT(77.2295 28.6129)')
  })

  it('round-trips through what Postgres generates back', () => {
    // Verified against the real database: this EWKT stored in a
    // geography(Point,4326) yields exactly these generated columns.
    const point = { lng: 77.2295, lat: 28.6129 }
    expect(toPointEwkt(point)).toBe('SRID=4326;POINT(77.2295 28.6129)')
    expect(pointFrom(28.6129, 77.2295)).toEqual(point)
  })

  it('handles the antimeridian and the poles', () => {
    expect(toPointEwkt({ lng: -180, lat: -90 })).toBe('SRID=4326;POINT(-180 -90)')
  })
})

describe('isValidLngLat', () => {
  it('accepts the poles and the antimeridian', () => {
    expect(isValidLngLat({ lng: 180, lat: 90 })).toBe(true)
    expect(isValidLngLat({ lng: -180, lat: -90 })).toBe(true)
  })

  it('rejects NaN, which is what a parsed empty input produces', () => {
    expect(isValidLngLat({ lng: Number.NaN, lat: 0 })).toBe(false)
  })
})

describe('formatLngLat', () => {
  it('reads latitude first, like every map app', () => {
    expect(formatLngLat({ lng: 77.229512, lat: 28.612894 })).toBe('28.6129, 77.2295')
  })
})
