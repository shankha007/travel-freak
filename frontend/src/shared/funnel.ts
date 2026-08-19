/**
 * The product funnel, named once.
 *
 * §7 of the plan asks for exactly this and says why: "PostHog funnel
 * `signup → onboarding complete → first trip → first photo → first share →
 * upgrade`, instrumented on day one. That funnel tells you where the product is
 * broken." Six steps, and the order of `FUNNEL` below *is* the funnel — the
 * PostHog insight is built from this array, so the dashboard and the code cannot
 * disagree about what step four is.
 *
 * Note this file is not `analytics.ts`, which is already taken by the arithmetic
 * behind screen 32 — the user's own analytics, about their travel. Two different
 * meanings of the word, and one of them belongs to a screen.
 *
 * ## Names are permanent
 *
 * An event name is a key in somebody else's database. Renaming one does not
 * rename the history: it starts a second series and silently truncates every
 * chart built on the first. So these are `snake_case` past-tense verbs chosen to
 * outlive the screens that emit them — `trip_created` rather than
 * `wizard_finished`, because the wizard may be replaced and a trip will still be
 * created.
 *
 * ## What is deliberately absent
 *
 * No pageviews, no autocapture, no session recording, no client-side SDK at all.
 * Every step below happens on the server — an account is created, a row is
 * written, a link is made — so the funnel is complete without shipping a tracking
 * script to anybody's browser. That keeps the CSP tight, leaves the bundle as it
 * was, and means a visitor running an ad blocker is counted the same as one who
 * is not, which is worth more to a funnel than knowing which button was hovered.
 */

export const FUNNEL = [
  'signed_up',
  'onboarding_completed',
  'trip_created',
  'photo_uploaded',
  'share_created',
  'upgrade_viewed',
] as const

export type FunnelEvent = (typeof FUNNEL)[number]

/**
 * The properties an event may carry, and no more.
 *
 * Typed rather than `Record<string, unknown>` so a property is spelled the same
 * way in the two places that send it. PostHog will happily accept `is_first` from
 * one call site and `isFirst` from another and show them as two unrelated
 * columns, with no error anywhere.
 */
export interface FunnelProperties {
  /**
   * Whether this is the account's first of its kind.
   *
   * The funnel step is "first trip", not "a trip", and this property is what
   * makes that answerable. A separate `first_trip_created` event would mean two
   * names for one action, and a funnel that could no longer show the second.
   */
  is_first?: boolean
  /** For `share_created`: what was shared, and how. */
  share_kind?: 'trip' | 'post'
  share_method?: 'published' | 'link'
  /** For `upgrade_viewed`: the plan they were on when they looked. */
  from_plan?: string
  /** For `photo_uploaded`: size, so storage pressure is visible in the funnel. */
  bytes?: number
}

/** PostHog's US cloud, used when no host is configured. */
export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'
