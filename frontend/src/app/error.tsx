'use client'

import { ErrorState } from '@/client/components/error-state'

/**
 * Error boundary for everything outside the authenticated app — the marketing
 * pages, the public trip and post readers, a profile.
 *
 * Sends people home rather than to the dashboard, because whoever is reading a
 * public page is quite possibly not signed in, and offering them a screen that
 * will bounce them to the login form is not help.
 */
export default function PublicError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <ErrorState
      error={error}
      retry={retry}
      description="This page did not load. It is usually worth trying again."
      homeHref="/"
      homeLabel="Go to the home page"
    />
  )
}
