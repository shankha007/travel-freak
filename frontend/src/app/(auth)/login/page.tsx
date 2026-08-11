import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { LoginForm } from '@/client/components/auth/login-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/client/components/ui/card'
import { Skeleton } from '@/client/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your travel globe.',
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to pick up where your globe left off.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* useSearchParams needs a Suspense boundary or the whole route opts
            out of static rendering. */}
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <LoginForm />
        </Suspense>

        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Local demo account</p>
          <p className="mt-1">
            demo@travelfreak.app · password123 — prefilled above. Seeded by{' '}
            <code className="font-mono">npm run db:start</code> in{' '}
            <code className="font-mono">backend/</code>.
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          No account yet?{' '}
          <Link
            href="/register"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
