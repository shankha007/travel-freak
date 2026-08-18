'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RotateCw } from 'lucide-react'
import { Button } from '@/client/components/ui/button'

/**
 * What a screen shows when its render threw.
 *
 * Shared by every `error.tsx` in the app, because the wording is the part worth
 * getting right once. Three rules it follows:
 *
 *  - **It never shows the error.** A thrown message can carry a row id, a
 *    column name, a fragment of somebody's data, or the shape of a query — none
 *    of which belongs on a stranger's screen, and in production React replaces
 *    it with a digest anyway. The digest *is* shown, because it is the one thing
 *    that makes a support conversation possible.
 *  - **It offers the retry.** Most of these are a failed fetch or a database
 *    that blinked, and trying again genuinely fixes them. The button is first
 *    because it is usually the answer.
 *  - **It does not blame the reader.** "Something went wrong" is honest; "an
 *    error occurred while processing your request" is a machine clearing its
 *    throat.
 */
export function ErrorState({
  error,
  retry,
  title = 'Something went wrong',
  description = 'This screen did not load. It is usually worth trying again — nothing you have recorded is affected.',
  homeHref = '/dashboard',
  homeLabel = 'Back to the dashboard',
}: {
  error: Error & { digest?: string }
  retry: () => void
  title?: string
  description?: string
  homeHref?: string
  homeLabel?: string
}) {
  // The console is where this is actually diagnosable in development, and in
  // production it is what a monitoring hook would attach to. Sentry is still
  // unbuilt — STATUS lists it — and when it arrives, it goes here.
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertCircle className="size-7 text-muted-foreground" aria-hidden />

      <div className="space-y-1">
        {/* Not an <h1>: this replaces a segment that may sit under a heading
            the layout already rendered, and two h1s read as two pages. */}
        <p className="text-lg font-medium">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCw className="size-4" aria-hidden />
          Try again
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href={homeHref} />}>
          {homeLabel}
        </Button>
      </div>

      {/* The only thing from the error itself that reaches the screen. It is a
          hash React generates for the stack, so it identifies the fault without
          describing it. */}
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Reference <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </div>
  )
}
