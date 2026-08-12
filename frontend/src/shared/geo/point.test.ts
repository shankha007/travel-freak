import { describe, expect, it } from 'vitest'
import { formatLngLat, isValidLngLat, parsePoint, toPointEwkt } from './point'

describe('parsePoint', () => {
  it('reads the GeoJSON PostgREST returns', () => {
    expect(parsePoint({ type: 'Point', coordinates: [77.2295, 28.6129] })).toEqual({
      lng: 77.2295,
      lat: 28.6129,
    })
  })

  it('accepts the same thing as a JSON string', () => {
    expect(parsePoint('{"type":"Point","coordinates":[77.2295,28.6129]}')).toEqual({
      lng: 77.2295,
      lat: 28.6129,
    })
  })

  it('treats anything else as no coordinates', () => {
    // A place with no pin is ordinary; none of these should throw.
    expect(parsePoint(null)).toBeNull()
    expect(parsePoint(undefined)).toBeNull()
    expect(parsePoint('0101000020E6100000')).toBeNull()
    expect(parsePoint({ type: 'LineString', coordinates: [] })).toBeNull()
    expect(parsePoint({ type: 'Point', coordinates: ['77', '28'] })).toBeNull()
  })

  it('rejects coordinates that are not on the earth', () => {
    expect(parsePoint({ type: 'Point', coordinates: [200, 28] })).toBeNull()
    expect(parsePoint({ type: 'Point', coordinates: [77, 91] })).toBeNull()
  })
})

describe('toPointEwkt', () => {
  it('writes EWKT with the SRID spelled out', () => {
    expect(toPointEwkt({ lng: 77.2295, lat: 28.6129 })).toBe('SRID=4326;POINT(77.2295 28.6129)')
  })

  it('round-trips through parsePoint via GeoJSON of the same numbers', () => {
    const point = { lng: -0.1276, lat: 51.5072 }
    expect(toPointEwkt(point)).toBe('SRID=4326;POINT(-0.1276 51.5072)')
    expect(parsePoint({ type: 'Point', coordinates: [point.lng, point.lat] })).toEqual(point)
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
