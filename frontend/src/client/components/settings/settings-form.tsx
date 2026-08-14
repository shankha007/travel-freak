'use client'

import { useFormStatus } from 'react-dom'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import type { SettingsState } from '@/server/actions/settings'
import { Button } from '@/client/components/ui/button'

/**
 * The three or four lines every settings form repeats.
 *
 * Extracted because there are four of them on one screen, and a save button
 * that says "Saving…" on one card and nothing on the next is the kind of
 * inconsistency that reads as a bug in the one that stayed silent.
 */

export function SubmitButton({ children = 'Save changes' }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : children}
    </Button>
  )
}

/**
 * Whatever the last submission had to say.
 *
 * `role="status"` on the success and `role="alert"` on the failure: both are
 * announced, and only the failure interrupts. A settings screen that saves
 * silently leaves people pressing the button twice.
 */
export function FormFeedback({ state }: { state: SettingsState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.error}
      </p>
    )
  }

  if (state.saved && state.message) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3 text-sm text-emerald-700 dark:text-emerald-400"
      >
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.message}
      </p>
    )
  }

  return null
}

/** One field's error, wired to the input through `aria-describedby`. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}
