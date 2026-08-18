'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { FormState } from '@/shared/validation/form-state'

/**
 * Announces the result of a Server Action.
 *
 * `sonner` has been installed and mounted since the shell was built and nothing
 * ever called it, so the app had two ways of reporting an action: a dialog that
 * closed, and a sentence rendered next to the form. That leaves the actions with
 * neither — a status changed from a select, an entry recorded from a button, a
 * row removed from a board — saying nothing at all. Those are exactly the ones
 * where the write is invisible until the page repaints.
 *
 * Fires once per submission, not once per render. `useActionState` hands back a
 * fresh object every time the action returns, so the previous one is the honest
 * way to tell a new result from a re-render — a boolean flag would re-announce
 * every time the parent re-rendered, and comparing the message would swallow the
 * same failure happening twice in a row, which is precisely when somebody needs
 * telling.
 *
 * Errors are announced by default. A silent failure is the worse bug, and a form
 * that already prints its own error passes `error: false` rather than saying it
 * twice.
 */
export function useActionToast(
  state: FormState,
  { success, error = true }: { success?: string; error?: boolean }
): void {
  // Seeded with the state as it is on first render, so a component mounted
  // *after* an action resolved — a dialog opened on a stale result — does not
  // announce something the user has already seen.
  const seen = useRef<FormState | null>(state)

  useEffect(() => {
    if (seen.current === state) return
    seen.current = state

    if (state.error) {
      if (error) toast.error(state.error)
      return
    }

    if (state.saved && success) toast.success(success)
  }, [state, success, error])
}
