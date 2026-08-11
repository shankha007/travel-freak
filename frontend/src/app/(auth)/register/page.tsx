import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { RegisterForm } from '@/client/components/auth/register-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/client/components/ui/card'
import { Skeleton } from '@/client/components/ui/skeleton'
import { BRAND } from '@/shared/brand'

export const metadata: Metadata = {
  title: 'Create your account',
  description: `Start your travel globe on ${BRAND.name}. Free, no card.`,
}

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Start your globe</CardTitle>
        {/* No numbers here on purpose: plan limits live in `plans.limits` and
            the pricing page renders them from there. Copy that repeats them
            drifts. */}
        <CardDescription>
          Free on Explorer, no card. Log a trip and watch your globe fill in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* useSearchParams needs a Suspense boundary or the whole route opts
            out of static rendering. */}
        <Suspense fallback={<Skeleton className="h-80 w-full" />}>
          <RegisterForm />
        </Suspense>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
