/**
 * Share cards — screen 38.
 *
 * The pure half: sizes, the palette, and the text arithmetic. Everything here
 * runs inside `ImageResponse`, which renders through Satori — a layout engine
 * that supports flexbox and little else. No cascade, no `gap` on some versions,
 * no text measurement you can query. So the copy has to be cut to length here
 * rather than trusted to ellipsize, which is why the truncation is a tested
 * function and not a CSS class.
 *
 * A card is seen at thumbnail size in a chat window. That is the whole design
 * brief: three or four large things, and nothing that needs to be read closely.
 */

/** Facebook and X both want 1.91:1; 1200×630 is the size everyone settled on. */
export const OG_SIZE = { width: 1200, height: 630 } as const

export const OG_CONTENT_TYPE = 'image/png'

/**
 * Fixed colours rather than the theme tokens.
 *
 * A share card has no `prefers-color-scheme` to read and no CSS variables to
 * resolve — it is a PNG. These are the dark palette's values, written out,
 * because a card is seen against someone else's timeline and dark reads as
 * deliberate where light reads as a screenshot.
 */
export const OG_COLORS = {
  background: '#0b1120',
  panel: '#111c33',
  ink: '#f8fafc',
  muted: '#94a3b8',
  accent: '#2dd4bf',
  /** Countries with nothing recorded. Deliberately low contrast — it is context. */
  land: '#1e293b',
  border: '#1e293b',
} as const

/**
 * Cuts a string to fit, on a word boundary where it can.
 *
 * Satori will happily lay out a 300-character title at 64px and push everything
 * below it off the canvas — there is no overflow to hide, because there is no
 * scroll. Breaking mid-word is worse than a slightly short line, so this walks
 * back to whitespace unless that would throw away most of the string.
 */
export function truncate(value: string, max: number): string {
  const text = value.trim().replace(/\s+/g, ' ')
  if (text.length <= max) return text

  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  // Only respect the word boundary if it is reasonably close to the limit;
  // otherwise a long unbroken string would collapse to almost nothing.
  const body = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${body.trimEnd()}…`
}

/**
 * The site card, for a page's own `openGraph` block.
 *
 * Needed because Next merges metadata shallowly: a page that declares an
 * `openGraph` object *replaces* the one above it, images included. So the
 * `opengraph-image.tsx` at the root reaches `/` and nothing else — every page
 * with a title of its own silently loses the card unless it says otherwise.
 *
 * Relative, resolved against `metadataBase` in the root layout, so it is
 * correct in development, in previews and in production without any of them
 * being named here.
 *
 * Pages with a card of their own — a trip, a post, a profile — do not use this;
 * their colocated `opengraph-image.tsx` is picked up automatically.
 */
export const SITE_OG_IMAGE = {
  url: '/opengraph-image',
  width: OG_SIZE.width,
  height: OG_SIZE.height,
  alt: 'A world map with the countries you have visited filled in',
} as const

/** Longest title that still sets at the card's largest size without wrapping past two lines. */
export const OG_TITLE_MAX = 72
export const OG_SUBTITLE_MAX = 120

/**
 * Joins the facts under a title into one line.
 *
 * Empty and zero entries are dropped rather than printed, because "0 countries"
 * on a share card is an advertisement for an empty account. If everything is
 * empty the caller gets an empty string and is expected to render nothing,
 * not an orphaned separator.
 */
export function factLine(parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(' · ')
}

/** "1 country" / "12 countries", or null when there is nothing to boast about. */
export function countLabel(count: number, one: string, many = `${one}s`): string | null {
  if (!Number.isFinite(count) || count <= 0) return null
  return `${count} ${count === 1 ? one : many}`
}
