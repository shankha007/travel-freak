'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { deleteBlogPost, type DeleteBlogState } from '@/server/actions/blogs'
import { Button } from '@/client/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'

const initialState: DeleteBlogState = { error: null }

function ConfirmButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Deleting…' : 'Delete post'}
    </Button>
  )
}

/** Delete confirmation for a post. Soft delete, same as trips. */
export function DeleteBlogDialog({ postId, title }: { postId: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(deleteBlogPost, initialState)

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{title}”?</DialogTitle>
            <DialogDescription>
              It comes off your blog list and, if it was published, off the web. The text is kept —
              restore it from{' '}
              <Link href="/trash" className="underline underline-offset-4">
                Trash
              </Link>{' '}
              within 30 days and a published post goes back live.
            </DialogDescription>
          </DialogHeader>

          {state.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.error}
            </p>
          )}

          <form action={formAction}>
            <input type="hidden" name="postId" value={postId} />
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Keep it
              </Button>
              <ConfirmButton />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
