'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { updatePrivacy, type SettingsState } from '@/server/actions/settings'
import type { SettingsData } from '@/server/queries/settings'
import { VISIBILITY_OPTIONS } from '@/shared/validation/settings'
import { FieldError, FormFeedback, SubmitButton } from '@/client/components/settings/settings-form'
import { Label } from '@/client/components/ui/label'
import { Switch } from '@/client/components/ui/switch'

/**
 * Privacy settings — screen 41.
 *
 * Two controls, and both of them say what they do to someone else's view of you
 * rather than what they set. "Public profile" is the switch that decides whether
 * `/u/<username>` exists at all; the default visibility decides what a trip
 * starts as, which is the setting that quietly matters most because it applies
 * to every trip you make from now on without asking again.
 */

const initialState: SettingsState = { error: null }

export function PrivacyForm({ settings }: { settings: SettingsData }) {
  const [state, formAction] = useActionState(updatePrivacy, initialState)
  const [isPublic, setIsPublic] = useState(settings.isPublic)

  return (
    <form action={formAction} className="space-y-6">
      <FormFeedback state={state} />

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="isPublic">Public profile</Label>
            <p className="text-sm text-muted-foreground">
              Turns on{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">/u/{settings.username}</code> —
              your bio, your counters and a read-only globe. Individual trips and posts keep their
              own visibility; this never overrides them.
            </p>
          </div>
          {/* The switch is what people reach for; the hidden input is what a
              form submits. Base UI's Switch is not a native checkbox, so the
              value has to be mirrored somewhere the FormData can see it. */}
          <Switch
            id="isPublic"
            checked={isPublic}
            onCheckedChange={setIsPublic}
            aria-describedby="isPublic-hint"
          />
        </div>
        {isPublic && <input type="hidden" name="isPublic" value="on" />}
        <p id="isPublic-hint" className="text-sm text-muted-foreground">
          {isPublic
            ? 'On. Anyone with the address can read it, and search engines may index it.'
            : 'Off. Your profile 404s for everyone but you.'}
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">What a new trip starts as</legend>
        <p className="text-sm text-muted-foreground">
          Applied when you create a trip. You can change any individual trip afterwards, and this
          never touches the ones you already have.
        </p>

        <div className="space-y-2">
          {VISIBILITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-muted/40"
            >
              <input
                type="radio"
                name="defaultTripVisibility"
                value={option.value}
                defaultChecked={settings.defaultTripVisibility === option.value}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block font-medium">{option.label}</span>
                <span className="block text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError id="visibility-error" message={state.fieldErrors?.defaultTripVisibility} />
      </fieldset>

      <SubmitButton />

      {/*
        `profiles.strip_exif_on_publish` exists as a column and defaults on, and
        this is deliberately not a switch for it. Nothing reads the column:
        publication always strips, which is the stricter of the two behaviours,
        and a control whose "off" position would publish the GPS coordinates in
        your photographs is not a preference worth offering. Stated rather than
        hidden, because a privacy screen that is silent about metadata is worse
        than one that says the answer is fixed.
      */}
      <div className="space-y-1 border-t pt-5">
        <p className="text-sm font-medium">Photo metadata</p>
        <p className="text-sm text-muted-foreground">
          Always stripped. Any photo you publish is re-encoded first, without its GPS coordinates,
          camera serial or timestamp — there is no setting for this because the only other position
          would put your locations in a public file. Your own copies keep everything.{' '}
          <Link href="/privacy#photos" className="underline underline-offset-4">
            How photos are handled
          </Link>
          .
        </p>
      </div>
    </form>
  )
}
