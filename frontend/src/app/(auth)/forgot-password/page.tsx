import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/client/components/auth/forgot-password-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/client/components/ui/card'

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Send yourself a link to set a new password.',
  // A recovery form has nothing to offer a search engine and everything to
  // offer someone crawling for login surfaces.
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Forgot your password?</CardTitle>
        <CardDescription>
          Give us the address you signed up with and we will send a link to set a new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ForgotPasswordForm />

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
