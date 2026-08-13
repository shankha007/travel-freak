'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Loader2, MailCheck } from 'lucide-react'
import { resendConfirmation, type RecoveryState } from '@/server/actions/auth'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'

const initialState: RecoveryState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Sending…' : 'Send another link'}
    </Button>
  )
}

export function ResendConfirmationForm() {
  const [state, formAction] = useActionState(resendConfirmation, initialState)

  if (state.sent) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground"
      >
        <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        If that address is waiting to be confirmed, a new link is on its way.
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="resend-email">Email</Label>
        <Input
          id="resend-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>

      {state.error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  )
}
