'use client'

import { useActionState, useId } from 'react'
import { useFormStatus } from 'react-dom'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react'
import { sendContactMessage, type ContactState } from '@/server/actions/contact'
import { CONTACT_TOPICS, MAX_MESSAGE_LENGTH } from '@/shared/validation/contact'
import { DURATION, EASE_OUT } from '@/shared/motion'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Textarea } from '@/client/components/ui/textarea'

/**
 * The `/contact` form — screen 6.
 *
 * Uncontrolled inputs and `useActionState`, matching the other forms in the
 * app. A rejected submission comes back with its values so nothing typed is
 * lost, because React resets an uncontrolled form the moment its action
 * returns and losing a long bug report to a mistyped address is a good way to
 * never hear about the bug.
 *
 * The success state replaces the form rather than sitting above it. This is the
 * one place in the product where an animation carries meaning rather than
 * polish: the form leaving and the acknowledgement arriving in its place is how
 * a reader knows the thing was sent and there is nothing left to do. Both halves
 * are dropped to a plain fade for anyone who asks for reduced motion, by the
 * `MotionConfig` in `providers.tsx`.
 */

const initialState: ContactState = { error: null }

function SendButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Send className="size-4" aria-hidden />
      )}
      {pending ? 'Sending…' : 'Send message'}
    </Button>
  )
}

export function ContactForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [state, formAction] = useActionState(sendContactMessage, initialState)
  const pathname = usePathname()
  const uid = useId()

  const err = (field: string) => state.fieldErrors?.[field]
  const rejected = state.values

  const initial = {
    name: rejected?.name ?? '',
    email: rejected?.email ?? defaultEmail,
    topic: rejected?.topic ?? 'support',
    message: rejected?.message ?? '',
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state.sent ? (
        <motion.div
          key="sent"
          role="status"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          className="rounded-xl border bg-muted/30 p-8 text-center"
        >
          <CheckCircle2
            className="mx-auto size-8 text-emerald-600 dark:text-emerald-500"
            aria-hidden
          />
          <h2 className="mt-4 text-xl font-semibold tracking-tight">That reached us.</h2>
          <p className="mx-auto mt-2 max-w-md text-pretty text-muted-foreground">
            We read every message ourselves and answer within about three working days. If it was a
            bug, telling us what you expected to happen is usually the part that fixes it fastest —
            reply to our answer with anything you left out.
          </p>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          action={formAction}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: DURATION.fast, ease: EASE_OUT }}
          className="space-y-5"
        >
          {/* Where they wrote from, so a report about a broken screen arrives
              with the screen attached. Nothing else about the visit is sent. */}
          <input type="hidden" name="sourcePath" value={pathname ?? ''} />

          {/* Honeypot: hidden from people, irresistible to a form-filling bot.
              `tabIndex={-1}` and `aria-hidden` keep it out of the keyboard order
              and out of a screen reader, which is what makes it honest. */}
          <div aria-hidden className="hidden">
            <label htmlFor={`${uid}-website`}>Website</label>
            <input
              id={`${uid}-website`}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {state.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.error}
            </p>
          )}

          {/* Every field is keyed on what it is re-seeded with.
              `defaultValue` is read on mount, so a value arriving back
              from a rejected submission is both ignored and — for the Base UI
              inputs — warned about; remounting is what makes the echo actually
              take. The keys change only when the action returns, never while
              someone is typing. */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                key={initial.name}
                id="name"
                name="name"
                defaultValue={initial.name}
                autoComplete="name"
                maxLength={80}
                required
                aria-describedby={err('name') ? 'name-error' : undefined}
              />
              {err('name') && (
                <p id="name-error" role="alert" className="text-sm text-destructive">
                  {err('name')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                key={initial.email}
                id="email"
                name="email"
                type="email"
                defaultValue={initial.email}
                autoComplete="email"
                maxLength={254}
                required
                aria-describedby={err('email') ? 'email-error' : 'email-hint'}
              />
              {err('email') ? (
                <p id="email-error" role="alert" className="text-sm text-destructive">
                  {err('email')}
                </p>
              ) : (
                <p id="email-hint" className="text-sm text-muted-foreground">
                  The only thing we do with this is reply to it.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic">What is this about?</Label>
            <select
              key={initial.topic}
              id="topic"
              name="topic"
              defaultValue={initial.topic}
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              aria-describedby={err('topic') ? 'topic-error' : undefined}
            >
              {CONTACT_TOPICS.map((topic) => (
                <option key={topic.value} value={topic.value}>
                  {topic.label}
                </option>
              ))}
            </select>
            {err('topic') && (
              <p id="topic-error" role="alert" className="text-sm text-destructive">
                {err('topic')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              key={initial.message}
              id="message"
              name="message"
              defaultValue={initial.message}
              rows={7}
              maxLength={MAX_MESSAGE_LENGTH}
              required
              placeholder="What happened, what you expected instead, and which screen you were on."
              aria-describedby={err('message') ? 'message-error' : undefined}
            />
            {err('message') && (
              <p id="message-error" role="alert" className="text-sm text-destructive">
                {err('message')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <SendButton />
            <p className="text-sm text-muted-foreground">
              Sent to us and nobody else. Never added to a mailing list.
            </p>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  )
}
