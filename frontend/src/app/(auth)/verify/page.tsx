import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleCheck, MailWarning } from 'lucide-react'
import { createClient } from '@/server/supabase/server'
import { ResendConfirmationForm } from '@/client/components/auth/resend-confirmation-form'
import { Button } from '@/client/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/client/components/ui/card'

/**
 * Where a confirmation link lands, and where a broken one is explained — screen 9.
 *
 * `/auth/confirm` forwards here on success with nothing in the query, and here
 * with `?error=` when the token would not verify. Both are ordinary outcomes of
 * a link that expires in an hour, so both get a page with a way forward.
 */
export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function VerifyPage({ searchParams }: PageProps<'/verify'>) {
  const query = await searchParams
  const error = typeof query.error === 'string' ? query.error : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <CircleCheck className="size-5 text-globe-visited" aria-hidden />
            Email confirmed
          </CardTitle>
          <CardDescription>
            {user
              ? `${user.email} is confirmed and you are signed in. Your globe is waiting.`
              : 'That address is confirmed. Sign in and your globe is waiting.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <Button className="w-full" nativeButton={false} render={<Link href="/dashboard" />}>
              Go to your dashboard
            </Button>
          ) : (
            <Button className="w-full" nativeButton={false} render={<Link href="/login" />}>
              Sign in
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const isMissing = error === 'missing'
  // A dead *reset* link needs a new reset link, not a confirmation email. The
  // confirm route tells us which kind it was precisely so this page can offer
  // the remedy that matches.
  const wasRecovery = query.type === 'recovery'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <MailWarning className="size-5 text-muted-foreground" aria-hidden />
          {isMissing
            ? 'Nothing to confirm'
            : wasRecovery
              ? 'That reset link has expired'
              : 'That link has expired'}
        </CardTitle>
        <CardDescription>
          {isMissing
            ? 'This page confirms an emailed link, and this visit carried none. Open the link from your inbox, or ask for a new one below.'
            : wasRecovery
              ? 'Reset links last an hour and work once. Ask for a fresh one and it will land in the same inbox.'
              : 'Confirmation links last an hour and work once. Ask for another and it will land in the same inbox.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {wasRecovery ? (
          <Button className="w-full" nativeButton={false} render={<Link href="/forgot-password" />}>
            Send a new reset link
          </Button>
        ) : (
          <ResendConfirmationForm />
        )}

        <p className="text-center text-sm text-muted-foreground">
          {wasRecovery ? (
            <>
              Or{' '}
              <Link
                href="/login"
                className="font-medium text-foreground underline underline-offset-4"
              >
                go back to sign in
              </Link>
            </>
          ) : (
            <>
              Forgotten your password instead?{' '}
              <Link
                href="/forgot-password"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Reset it
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  )
}
