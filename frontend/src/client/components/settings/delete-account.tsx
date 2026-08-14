'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { deleteAccount, type DeleteAccountState } from '@/server/actions/account'
import { FieldError } from '@/client/components/settings/settings-form'
import { Button } from '@/client/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'

/**
 * Deleting the account — screen 44.
 *
 * Behind a dialog, and behind two things typed by hand: the username, which
 * cannot be produced by a mis-click, and the password, which cannot be produced
 * by someone who has walked past an unlocked laptop. Both are checked on the
 * server; neither is theatre.
 *
 * The copy says what goes and what does not, before the button rather than
 * after. Someone about to delete a decade of photographs deserves the sentence
 * "this cannot be undone" *and* the offer of the export that would have made it
 * survivable — which is why the download sits directly above this on the page.
 */

const initialState: DeleteAccountState = { error: null }

function ConfirmButton({ armed }: { armed: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending || !armed}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Deleting…' : 'Delete my account'}
    </Button>
  )
}

export function DeleteAccount({ username }: { username: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(deleteAccount, initialState)
  const [typed, setTyped] = useState('')

  // The button stays disabled until the username matches. The server checks the
  // same thing — this is so the dialog cannot be submitted by pressing Enter in
  // the password field before reading anything.
  const armed = typed.trim().toLowerCase() === username.toLowerCase()

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden />
        Delete account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete your account</DialogTitle>
            <DialogDescription>
              This cannot be undone, and there is no 30-day window on it — that is the trash, and
              this is not that.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">What goes</p>
            <p className="text-muted-foreground">
              Your profile, every trip and place, every photograph and the files behind them, your
              posts, your wishlist and your globe. Public pages stop resolving immediately. Backups
              roll off on their own cycle, within 30 days.
            </p>
            <p className="text-muted-foreground">
              Messages you have sent us stay, with your account no longer attached to them, so a
              conversation in progress does not vanish mid-sentence.
            </p>
          </div>

          <form action={formAction} className="space-y-4">
            {state.error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {state.error}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirm">
                Type <span className="font-mono">{username}</span> to confirm
              </Label>
              <Input
                id="confirm"
                name="confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                aria-describedby={state.fieldErrors?.confirm ? 'confirm-error' : undefined}
              />
              <FieldError id="confirm-error" message={state.fieldErrors?.confirm} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deletePassword">Your password</Label>
              <Input
                id="deletePassword"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-describedby={state.fieldErrors?.password ? 'password-error' : undefined}
              />
              <FieldError id="password-error" message={state.fieldErrors?.password} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Keep my account
              </Button>
              <ConfirmButton armed={armed} />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
