'use client'

import { useActionState } from 'react'
import { changeEmail, changePassword, type SettingsState } from '@/server/actions/settings'
import { MIN_PASSWORD_LENGTH } from '@/shared/validation/auth'
import { FieldError, FormFeedback, SubmitButton } from '@/client/components/settings/settings-form'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'

/**
 * Account and security — screen 40.
 *
 * Two forms rather than one, because they fail independently: mistyping the new
 * password should not discard a half-typed address, and each has its own thing
 * to say on success — one is done, the other has only started.
 */

const initialState: SettingsState = { error: null }

export function ChangeEmailForm({
  email,
  pendingEmail,
}: {
  email: string
  pendingEmail: string | null
}) {
  const [state, formAction] = useActionState(changeEmail, initialState)
  const err = (field: string) => state.fieldErrors?.[field]

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />

      {/* Supabase parks the requested address on the user until the link is
          opened. Saying so is what stops "I changed it and nothing happened". */}
      {pendingEmail && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
          A change to <span className="font-medium">{pendingEmail}</span> is waiting on the
          confirmation link sent there. Until it is opened, {email} is still your address.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={email}
          autoComplete="email"
          maxLength={254}
          required
          aria-describedby={err('email') ? 'email-error' : 'email-hint'}
        />
        <FieldError id="email-error" message={err('email')} />
        {!err('email') && (
          <p id="email-hint" className="text-sm text-muted-foreground">
            This is what you sign in with. Changing it sends a link to the new address; nothing
            changes until you open it.
          </p>
        )}
      </div>

      <SubmitButton>Send confirmation</SubmitButton>
    </form>
  )
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePassword, initialState)
  const err = (field: string) => state.fieldErrors?.[field]

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} />

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={err('currentPassword') ? 'currentPassword-error' : undefined}
        />
        <FieldError id="currentPassword-error" message={err('currentPassword')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            aria-describedby={err('newPassword') ? 'newPassword-error' : 'newPassword-hint'}
          />
          <FieldError id="newPassword-error" message={err('newPassword')} />
          {!err('newPassword') && (
            <p id="newPassword-hint" className="text-sm text-muted-foreground">
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
            aria-describedby={err('confirmPassword') ? 'confirmPassword-error' : undefined}
          />
          <FieldError id="confirmPassword-error" message={err('confirmPassword')} />
        </div>
      </div>

      <SubmitButton>Change password</SubmitButton>
    </form>
  )
}
