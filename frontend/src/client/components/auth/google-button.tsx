'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { signInWithGoogle, type AuthFormState } from '@/server/actions/auth'
import { Button } from '@/client/components/ui/button'

const initialState: AuthFormState = { error: null }

/**
 * "Continue with Google", on both the sign-in and the create-account screens.
 *
 * One component for both, because with OAuth they are the same act: Google does
 * not distinguish them and neither does Supabase, which creates the account on
 * first arrival. Labelling it "Continue" rather than "Sign in" or "Sign up" is
 * that fact made visible, rather than two buttons that do the same thing under
 * different names.
 *
 * Its own `<form>`, deliberately: nesting it inside the credentials form would
 * make it a second submit button on a form whose Enter key must belong to the
 * password field. Separate forms also mean the two actions have separate pending
 * states, so pressing one does not grey out the other.
 */
export function GoogleButton({ next }: { next?: string | null }) {
  const [state, formAction] = useActionState(signInWithGoogle, initialState)

  return (
    <form action={formAction} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}
      <GoogleSubmit />

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}
    </form>
  )
}

function GoogleSubmit() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <GoogleMark className="size-4" />
      )}
      {pending ? 'Redirecting…' : 'Continue with Google'}
    </Button>
  )
}

/**
 * Google's mark, inline.
 *
 * Inline rather than an `<img>` from Google's CDN for two reasons that point the
 * same way: the CSP allows images from this origin and Supabase Storage only, and
 * a request to a third party at the moment somebody is about to authenticate is a
 * request that says where they are. `aria-hidden` because the button already says
 * "Google" in words.
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.63l3.99 3.09C6.22 6.87 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}

/**
 * The rule above the button.
 *
 * A separate export so each screen places it itself — the sign-in page puts
 * Google first and the credentials below, and a divider baked into the button
 * would have appeared on the wrong side of one of them.
 */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      {/* Not `aria-hidden`: "or" is the word that explains why there are two ways
          to sign in, and a screen reader user needs it as much as anyone. */}
      <span className="text-xs text-muted-foreground">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
