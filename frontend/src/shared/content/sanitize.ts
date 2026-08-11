import sanitizeHtml from 'sanitize-html'

/**
 * Allowlist for stored post HTML.
 *
 * `blog_posts.content_html` is written by the author's editor, so it is user
 * input that a public page renders on the same origin as the session cookie.
 * Sanitising on *read* rather than only on write means posts stored before this
 * existed — and any written by a future import path — cannot carry a script
 * through. Anything not named here is dropped, so the failure mode of a new tag
 * is missing formatting, never execution.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'strong',
    'em',
    'b',
    'i',
    'u',
    's',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'figure',
    'figcaption',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    // `rel` is allowed because transformTags below sets it; without it here the
    // hardening would be stripped straight back off.
    a: ['href', 'title', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    '*': ['class'],
  },
  // No `data:` — an SVG data URI in an <img> is a script delivery mechanism.
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    // Outbound links from user content must not leak the referrer or hand the
    // opened tab a window.opener handle.
    a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer' }),
  },
}

/** Post HTML with everything outside the allowlist removed. */
export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS)
}
