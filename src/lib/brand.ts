/**
 * Single source of truth for product naming.
 *
 * The product name is a working title and is expected to change. Nothing outside
 * this file should hardcode it — import from here instead, so a rename is a
 * one-file edit. This includes metadata, emails, OG images and legal copy.
 */

export const BRAND = {
  /** Product name as shown to users. */
  name: 'TravelFreak',
  /** Short tagline used in metadata and the marketing hero. */
  tagline: 'Your personal travel OS',
  /** Longer description for meta tags and social cards. */
  description:
    'Plan your next trip, document the ones you have taken, and watch your world map fill in. Trips, memories, blogs and an interactive globe — all in one place.',
  /** Bare domain, no protocol. Used for canonical URLs and email addresses. */
  domain: 'travelfreak.app',
  /** Shown on public pages published by users on the free plan. */
  freePlanBadge: 'Made with TravelFreak',
  support: {
    email: 'support@travelfreak.app',
  },
  social: {
    x: '@travelfreak',
  },
} as const

/** Absolute site origin. Falls back to the brand domain in production builds. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : `https://${BRAND.domain}`)

/** Builds a page title in the form "Trips · TravelFreak". */
export function pageTitle(page?: string): string {
  return page ? `${page} · ${BRAND.name}` : `${BRAND.name} — ${BRAND.tagline}`
}
