/**
 * Plain-text derivations from post HTML: reading time and the excerpt fallback.
 *
 * Both run on already-sanitised HTML, so the tag set is known and small — a
 * regex is enough and does not need a DOM on the server.
 */

/** Average adult reading speed for prose, in words per minute. */
const WORDS_PER_MINUTE = 200

export function htmlToText(html: string): string {
  return (
    html
      // Block boundaries become spaces so "</p><p>" does not glue words together.
      .replace(/<\/(p|div|h[1-6]|li|blockquote|figcaption|tr)>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  )
}

export function countWords(text: string): number {
  if (!text) return 0
  return text.split(' ').filter(Boolean).length
}

/**
 * Reading time in whole minutes, never zero.
 *
 * A post that takes twenty seconds still reads as "1 min read" — rounding it to
 * 0 looks like a bug, and no reader has ever been misled by that minute.
 */
export function readingMinutes(html: string): number {
  return Math.max(1, Math.round(countWords(htmlToText(html)) / WORDS_PER_MINUTE))
}

/**
 * First sentence-ish of the post, for a writer who has not written an excerpt.
 *
 * Cuts on a word boundary rather than mid-word, and only adds an ellipsis when
 * something was actually cut.
 */
export function excerptFrom(html: string, limit = 200): string {
  const text = htmlToText(html)
  if (text.length <= limit) return text

  const cut = text.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : limit).trimEnd()}…`
}
