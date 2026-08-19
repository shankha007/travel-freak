import * as Sentry from '@sentry/nextjs'

/**
 * Sentry in the browser.
 *
 * Runs after the document loads and **before** React hydrates, which is the whole
 * reason this file convention exists: an error thrown during hydration is one of
 * the hardest to reproduce and one of the easiest to miss, and a reporter
 * installed inside a component is installed too late to catch it.
 *
 * Unset DSN means nothing is initialised and nothing is shipped — see
 * `instrumentation.ts` for why that is the default rather than a fallback.
 *
 * ## What this is not
 *
 * Not analytics. The funnel is captured entirely on the server (`shared/funnel.ts`
 * says why), so there is no product-analytics SDK in the browser bundle at all;
 * this is error reporting and stops there. No session replay, no user feedback
 * widget, no automatic breadcrumbs from user input — a breadcrumb trail through a
 * travel journal is a transcript of somebody's private writing.
 */

const dsn = clean(process.env.NEXT_PUBLIC_SENTRY_DSN)

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/^['"]|['"]$/g, '') ?? ''
  return trimmed.length > 0 ? trimmed : undefined
}

if (dsn) {
  Sentry.init({
    dsn,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,

    /**
     * Breadcrumbs from typing are dropped before they are recorded.
     *
     * The SDK's default `dom` breadcrumbs include the target of every input
     * event. On this product that means the text of a blog post, a trip summary
     * or a place name — private writing, attached to an error report about
     * something else entirely. Clicks are kept, because "clicked Save, then it
     * threw" is the sentence a report is usually missing.
     */
    beforeBreadcrumb(breadcrumb) {
      return breadcrumb.category === 'ui.input' ? null : breadcrumb
    },
  })
}

/**
 * Navigation breadcrumbs.
 *
 * The App Router navigates without a document load, so without this every report
 * from a session names the page the visitor first arrived on. Only the pathname
 * is recorded — a query string here can carry a share token (`?k=`), and a secret
 * that ends up in an error dashboard has been shared with more people than its
 * owner chose.
 */
export function onRouterTransitionStart(url: string, navigationType: string) {
  if (!dsn) return

  let path = url
  try {
    path = new URL(url, window.location.origin).pathname
  } catch {
    // A URL the parser refuses is not one worth recording verbatim.
    path = '(unparseable)'
  }

  Sentry.addBreadcrumb({
    category: 'navigation',
    message: path,
    level: 'info',
    data: { navigationType },
  })
}
