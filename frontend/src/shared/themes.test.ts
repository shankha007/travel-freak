import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DARK_THEME_CLASSES, THEMES, THEME_IDS, THEME_VALUES, themeById } from './themes'

/**
 * The registry and the stylesheet have to agree.
 *
 * A theme is three things in three files: an entry here, a class block in
 * globals.css, and — for a dark palette — membership of the `dark` variant.
 * Miss the third and the palette renders with every `dark:` utility still at its
 * light value, which looks like a broken theme rather than a missing line.
 */
const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('THEMES', () => {
  it('has unique ids and classes', () => {
    expect(new Set(THEME_IDS).size).toBe(THEMES.length)
    expect(new Set(THEMES.map((t) => t.className)).size).toBe(THEMES.length)
  })

  it('keeps light and dark named as the framework names them', () => {
    expect(themeById('light')?.className).toBe('light')
    expect(themeById('dark')?.className).toBe('dark')
  })

  it('offers palettes beyond plain light and dark', () => {
    expect(THEMES.length).toBeGreaterThan(2)
    expect(THEMES.some((t) => t.mode === 'light' && t.id !== 'light')).toBe(true)
    expect(THEMES.some((t) => t.mode === 'dark' && t.id !== 'dark')).toBe(true)
  })

  it('gives every theme a label, a description and three swatch colours', () => {
    for (const theme of THEMES) {
      expect(theme.label).not.toBe('')
      expect(theme.description).not.toBe('')
      expect(theme.swatch).toHaveLength(3)
      for (const colour of theme.swatch) expect(colour).toMatch(/^oklch\(|^#|^rgb/)
    }
  })

  it('maps every id to its class for next-themes', () => {
    expect(THEME_VALUES).toEqual(Object.fromEntries(THEMES.map((t) => [t.id, t.className])))
  })
})

describe('globals.css', () => {
  it('defines a block for every theme class', () => {
    for (const theme of THEMES) {
      // `light` is the bare `:root` block rather than a class of its own.
      if (theme.id === 'light') continue
      expect(CSS, `${theme.className} has no CSS block`).toContain(`.${theme.className}`)
    }
  })

  it('includes every dark palette in the dark variant', () => {
    const variant = CSS.match(/@custom-variant dark \(([^)]*)\)/)?.[1] ?? ''
    for (const className of DARK_THEME_CLASSES) {
      expect(variant, `${className} is missing from the dark variant`).toContain(className)
    }
  })

  it('includes every dark palette in the dark base block', () => {
    // The selector list that carries the shared dark variables.
    const base = CSS.match(/(\.dark[^{]*)\{\s*--background/)?.[1] ?? ''
    for (const className of DARK_THEME_CLASSES) {
      expect(base, `${className} does not inherit the dark base`).toContain(className)
    }
  })

  it('gives every palette its own region-state and map colours', () => {
    // A palette that changed the chrome but not the map would leave the globe
    // and the 2D map looking like they belong to a different product.
    for (const theme of THEMES) {
      if (theme.id === 'light' || theme.id === 'dark') continue
      const block = CSS.split(`.${theme.className} {`)[1]?.split('\n}')[0] ?? ''
      expect(block, `${theme.className} sets no map colours`).toContain('--map-water')
      expect(block, `${theme.className} sets no region colours`).toContain('--globe-visited')
    }
  })
})
