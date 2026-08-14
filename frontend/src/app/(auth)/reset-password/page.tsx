import type { Metadata } from 'next'
import Link from 'next/link'
import { KeyRound, LinkIcon } from 'lucide-react'
import { createClient } from '@/server/supabase/server'
import { ResetPasswordForm } from '@/client/components/auth/reset-password-form'
import { Button } from '@/client/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/client/components/ui/card'

/**
 * Choosing a new password — screen 9.
 *
 * Reached from `/auth/confirm`, which has already turned the emailed token into
 * a session. That session is the authorisation, so the only question this page
 * asks is whether there is one: without it there is nothing to update, and the
 * honest answer is that the link has expired rather than an empty form that
 * fails on submit.
 */
export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">That link has expired</CardTitle>
          <CardDescription>
            Reset links last an hour and work once. Ask for a fresh one and it will land in the same
            inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LinkIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <Button className="w-full" nativeButton={false} render={<Link href="/forgot-password" />}>
            Send a new link
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <KeyRound className="size-5 text-muted-foreground" aria-hidden />
          Set a new password
        </CardTitle>
        <CardDescription>
          You are signed in as {user.email}. Choose the password you will use from now on.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  )
}
