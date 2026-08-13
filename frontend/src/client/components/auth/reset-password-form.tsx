'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { resetPassword, type ResetPasswordState } from '@/server/actions/auth'
import { MIN_PASSWORD_LENGTH } from '@/shared/validation/auth'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'

const initialState: ResetPasswordState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : 'Set the new password'}
    </Button>
  )
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPassword, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          // `new-password` rather than `current-password`: it is what tells a
          // password manager to offer to generate one and then save it.
          autoComplete="new-password"
          required
          autoFocus
          minLength={MIN_PASSWORD_LENGTH}
          aria-describedby={state.fieldErrors?.password ? 'password-error' : 'password-hint'}
        />
        {state.fieldErrors?.password ? (
          <p id="password-error" role="alert" className="text-sm text-destructive">
            {state.fieldErrors.password}
          </p>
        ) : (
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby={state.fieldErrors?.confirmPassword ? 'confirm-error' : undefined}
        />
        {state.fieldErrors?.confirmPassword && (
          <p id="confirm-error" role="alert" className="text-sm text-destructive">
            {state.fieldErrors.confirmPassword}
          </p>
        )}
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
    </form>
  )
}
