import { describe, expect, it } from 'vitest'
import { blankStyle, hasBasemap, mapStyleUrl } from './map-style'

describe('mapStyleUrl', () => {
  it('builds a MapTiler style URL when a key is configured', () => {
    const style = mapStyleUrl('abc123')

    expect(typeof style).toBe('string')
    expect(style).toContain('api.maptiler.com')
    expect(style).toContain('key=abc123')
  })

  it('falls back to a blank style rather than failing without a key', () => {
    // The polygons are the content; the basemap is context. A missing key
    // should cost the context, not the page.
    expect(mapStyleUrl(undefined)).toEqual(blankStyle())
    expect(mapStyleUrl('')).toEqual(blankStyle())
  })
})

describe('blankStyle', () => {
  it('is a valid style with nothing to fetch', () => {
    const style = blankStyle()

    expect(style.version).toBe(8)
    expect(style.layers).toHaveLength(1)
    expect(style.layers[0].type).toBe('background')
    // Declaring glyphs or a sprite would make MapLibre request assets that do
    // not exist for a style with no text or icons.
    expect(style).not.toHaveProperty('glyphs')
    expect(style).not.toHaveProperty('sprite')
  })

  it('returns a new object each time, because MapLibre mutates what it is given', () => {
    expect(blankStyle()).not.toBe(blankStyle())
  })
})

describe('hasBasemap', () => {
  it('is false without a key', () => {
    expect(hasBasemap(undefined)).toBe(false)
    expect(hasBasemap('')).toBe(false)
    expect(hasBasemap('key')).toBe(true)
  })
})
