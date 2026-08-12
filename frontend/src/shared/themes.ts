/**
 * The themes a user can pick, and the single source of truth for them.
 *
 * `next-themes` stores the `id`; the `className` is what lands on `<html>`, and
 * the matching CSS block in globals.css is what it selects. Three things have to
 * agree — the picker, the provider and the stylesheet — so they all read this.
 *
 * `mode` is not decoration either. A dark palette must also match the `dark`
 * variant in globals.css, or every `dark:` utility in the app keeps its light
 * value on a dark background. Adding a dark palette here means adding its class
 * to that variant, which the test alongside this file enforces.
 */

export type ThemeMode = 'light' | 'dark'

export interface ThemeDefinition {
  /** Stored by next-themes and shown in the URL of nothing — internal id. */
  id: string
  label: string
  /** What goes on `<html>`. `light` and `dark` are the framework's own names. */
  className: string
  mode: ThemeMode
  /** One line in the picker, so a name like "Nightfall" is not the only clue. */
  description: string
  /**
   * Three colours for the picker's swatch, darkest last. Plain CSS colours
   * rather than variables: the swatch has to show a theme you are *not*
   * currently using, so it cannot read the live custom properties.
   */
  swatch: [string, string, string]
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'light',
    label: 'Light',
    className: 'light',
    mode: 'light',
    description: 'The default. Teal on white.',
    swatch: ['oklch(1 0 0)', 'oklch(0.87 0.006 220)', 'oklch(0.52 0.104 196)'],
  },
  {
    id: 'dark',
    label: 'Dark',
    className: 'dark',
    mode: 'dark',
    description: 'The default, at night.',
    swatch: ['oklch(0.205 0 0)', 'oklch(0.34 0.008 220)', 'oklch(0.72 0.115 196)'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    className: 'theme-ocean',
    mode: 'light',
    description: 'Deep blue, cool paper.',
    swatch: ['oklch(0.99 0.005 240)', 'oklch(0.85 0.03 240)', 'oklch(0.5 0.145 250)'],
  },
  {
    id: 'sunset',
    label: 'Sunset',
    className: 'theme-sunset',
    mode: 'light',
    description: 'Warm terracotta on sand.',
    swatch: ['oklch(0.99 0.008 70)', 'oklch(0.88 0.04 60)', 'oklch(0.57 0.16 40)'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    className: 'theme-midnight',
    mode: 'dark',
    description: 'Indigo, for the late edit.',
    swatch: ['oklch(0.17 0.025 275)', 'oklch(0.3 0.04 275)', 'oklch(0.72 0.15 285)'],
  },
  {
    id: 'forest',
    label: 'Forest',
    className: 'theme-forest',
    mode: 'dark',
    description: 'Deep green, low contrast.',
    swatch: ['oklch(0.18 0.022 160)', 'oklch(0.3 0.035 160)', 'oklch(0.72 0.14 162)'],
  },
]

/** Every dark-family class, which the `dark` variant in globals.css must cover. */
export const DARK_THEME_CLASSES = THEMES.filter((t) => t.mode === 'dark').map((t) => t.className)

/** `{ id: className }`, the shape next-themes wants for its `value` prop. */
export const THEME_VALUES: Record<string, string> = Object.fromEntries(
  THEMES.map((theme) => [theme.id, theme.className])
)

export const THEME_IDS = THEMES.map((theme) => theme.id)

export function themeById(id: string | undefined): ThemeDefinition | undefined {
  return THEMES.find((theme) => theme.id === id)
}
