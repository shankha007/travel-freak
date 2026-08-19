import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/shared/brand'

/**
 * `robots.txt`, and the list is shorter than it looks.
 *
 * Almost nothing here needs disallowing, because almost nothing here is
 * reachable: every route behind the login is guarded by the proxy, so a crawler
 * following a stray link to `/dashboard` is redirected to `/login` and indexes
 * that instead. The entries below are the cases where a crawl would be wasteful
 * or would put a page in an index that has no business being there.
 *
 * The authenticated shell is listed anyway. Not for the crawler's sake but for
 * the reader's: a `robots.txt` that says only `Allow: /` gives no one a way to
 * tell "we thought about this" from "we generated a file".
 *
 * **Unlisted content is deliberately absent.** A share token lives in a query
 * string, and naming the pattern here would be publishing a map to the very URLs
 * the token exists to keep out of an index. `/t/[slug]` and `/b/[slug]` already
 * carry `noindex` when they are opened with a token, which is the mechanism that
 * actually works — a `Disallow` a crawler chooses to ignore is not one.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Nothing behind the login is public, and a crawler that follows one of
          // these gets a login page for its trouble.
          '/dashboard',
          '/globe',
          '/maps/',
          '/trips/',
          '/blogs/',
          '/wishlist',
          '/timeline',
          '/analytics',
          '/resume',
          '/settings',
          '/trash',
          '/welcome',
          // Auth flows. `/auth/confirm` carries a single-use token in its query
          // string, and a crawler that fetches such a link spends it before the
          // person who was sent it can.
          '/auth/',
          '/reset-password',
          '/verify',
          // API routes answer JSON or 401, and neither belongs in an index.
          '/api/',
          // A redirect to `/pricing` that records who clicked. `/pricing` itself
          // is indexable and canonical; this is the same destination with a side
          // effect, and a crawler following it would be counted as an upgrade
          // view by every crawl.
          '/upgrade',
          // Sentry's tunnel, which exists so an ad blocker cannot stop error
          // reports. It answers to the SDK and to nothing else.
          '/monitoring',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
