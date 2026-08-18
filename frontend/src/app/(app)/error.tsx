'use client'

import { ErrorState } from '@/client/components/error-state'

/**
 * Error boundary for the authenticated app.
 *
 * Placed on the route group rather than on each screen, so it catches every
 * page under it while the shell around it survives: the header, the sidebar and
 * the bottom bar are rendered by the group's layout, which is *outside* this
 * boundary. Somebody whose analytics screen threw keeps their navigation and can
 * walk away from it — which is the whole reason to put boundaries at group
 * level rather than one at the root.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <ErrorState error={error} retry={retry} />
}
