'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Loader2, MailCheck } from 'lucide-react'
import { signUp, type SignUpState } from '@/server/actions/auth'
import { MIN_PASSWORD_LENGTH } from '@/shared/validation/auth'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'

const initialState: SignUpState = { error: null }

function SubmitButton() {
  // Read from the form context rather than the action state: this stays true
  // for the whole submission, including the redirect that follows success.
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Creating your account…' : 'Create account'}
    </Button>
  )
}

export function RegisterForm() {
  const [state, formAction] = useActionState(signUp, initialState)
  const next = useSearchParams().get('next')

  // Only reached when the project requires email confirmation. Locally that is
  // off, so the action redirects to the dashboard instead of landing here.
  if (state.confirmationRequired) {
    return (
      <div className="space-y-4 text-center" role="status">
        <MailCheck className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">Check your inbox</p>
          <p className="text-sm text-muted-foreground">
            We sent you a confirmation link. Click it and your globe is ready.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Back to sign in
        </Button>
      </div>
    )
  }

  const err = (field: string) => state.fieldErrors?.[field]

  return (
    <form action={formAction} className="space-y-4">
      {/* Preserved from the proxy redirect so users land where they were headed. */}
      {next && <input type="hidden" name="next" value={next} />}

      <div className="space-y-2">
        <Label htmlFor="displayName">Name</Label>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          placeholder="Optional"
          aria-invalid={Boolean(err('displayName'))}
        />
        {err('displayName') && <p className="text-sm text-destructive">{err('displayName')}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          aria-invalid={Boolean(err('email'))}
        />
        {err('email') && <p className="text-sm text-destructive">{err('email')}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          aria-invalid={Boolean(err('password'))}
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
        {err('password') && <p className="text-sm text-destructive">{err('password')}</p>}
      </div>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <SubmitButton />

      <p className="text-center text-xs text-muted-foreground">
        Trips are private by default. Nothing is published until you say so.
      </p>
    </form>
  )
}
