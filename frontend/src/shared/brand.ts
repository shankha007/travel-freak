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
    /** Privacy requests — export, correction, deletion. Separated so it can be routed. */
    privacyEmail: 'privacy@travelfreak.app',
  },
  /**
   * The details the legal pages have to state and nothing else may guess.
   *
   * `entity` is the working name until the service is incorporated; the pages
   * say so rather than implying a company that does not exist yet. Changing
   * these three lines is what turns the published policies from honest drafts
   * into the terms of a registered business — no page hardcodes them.
   */
  legal: {
    entity: 'TravelFreak',
    /** Whose law governs, and whose courts hear a dispute. */
    jurisdiction: 'India',
    courts: 'the courts at Kolkata, West Bengal',
    /** Where user data physically lives, stated on the privacy page. */
    dataRegion: 'Singapore (ap-southeast-1)',
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
