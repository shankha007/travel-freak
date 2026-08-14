'use client'

import { useActionState, useState } from 'react'
import { updateProfile, type SettingsState } from '@/server/actions/settings'
import type { SettingsData } from '@/server/queries/settings'
import { ALL_COUNTRIES } from '@/shared/geo/countries'
import { MAX_INTERESTS } from '@/shared/validation/settings'
import { FieldError, FormFeedback, SubmitButton } from '@/client/components/settings/settings-form'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Textarea } from '@/client/components/ui/textarea'

/**
 * Profile settings — screen 39.
 *
 * The username is the one field here with a consequence beyond this page: it is
 * the public URL, so changing it breaks every link anyone has to the old one.
 * The form says that where it can be read before the change rather than after,
 * and only when the field has actually been edited — a warning shown at rest is
 * a warning nobody reads.
 */

const initialState: SettingsState = { error: null }

export function ProfileForm({ settings }: { settings: SettingsData }) {
  const [state, formAction] = useActionState(updateProfile, initialState)
  const [username, setUsername] = useState(settings.username)

  const err = (field: string) => state.fieldErrors?.[field]
  const renaming = username.trim().toLowerCase() !== settings.username

  // What each field starts with: the rejected submission if there was one, then
  // the saved profile. React resets an uncontrolled form once its action
  // returns, so without the first of these, being told the username was taken
  // would also silently discard the bio you had just rewritten. The keys make
  // the re-seeded values actually take, since `defaultValue` is read on mount.
  const rejected = state.values
  const initial = {
    displayName: rejected?.displayName ?? settings.displayName,
    bio: rejected?.bio ?? settings.bio,
    countryCode: rejected?.countryCode ?? settings.countryCode ?? '',
    city: rejected?.city ?? settings.city,
    interests: rejected?.interests ?? settings.interests.join(', '),
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormFeedback state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
            required
            aria-describedby={err('username') ? 'username-error' : 'username-hint'}
          />
          <FieldError id="username-error" message={err('username')} />
          {!err('username') && (
            <p id="username-hint" className="text-sm text-muted-foreground">
              {renaming ? (
                <span className="text-amber-700 dark:text-amber-500">
                  Your public profile moves to /u/{username.trim().toLowerCase()}. Links to the old
                  address stop working.
                </span>
              ) : (
                <>Your public profile lives at /u/{settings.username}.</>
              )}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            key={initial.displayName}
            id="displayName"
            name="displayName"
            defaultValue={initial.displayName}
            maxLength={80}
            placeholder="What people should call you"
            aria-describedby={err('displayName') ? 'displayName-error' : undefined}
          />
          <FieldError id="displayName-error" message={err('displayName')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          key={initial.bio}
          id="bio"
          name="bio"
          defaultValue={initial.bio}
          rows={3}
          maxLength={300}
          placeholder="A line or two, shown on your public profile."
          aria-describedby={err('bio') ? 'bio-error' : undefined}
        />
        <FieldError id="bio-error" message={err('bio')} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="countryCode">Home country</Label>
          <select
            key={initial.countryCode}
            id="countryCode"
            name="countryCode"
            defaultValue={initial.countryCode}
            className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
            aria-describedby={err('countryCode') ? 'countryCode-error' : undefined}
          >
            <option value="">Rather not say</option>
            {ALL_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          <FieldError id="countryCode-error" message={err('countryCode')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">Home city</Label>
          <Input
            key={initial.city}
            id="city"
            name="city"
            defaultValue={initial.city}
            maxLength={120}
            placeholder="Optional"
            aria-describedby={err('city') ? 'city-error' : undefined}
          />
          <FieldError id="city-error" message={err('city')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="interests">Travel interests</Label>
        <Input
          key={initial.interests}
          id="interests"
          name="interests"
          defaultValue={initial.interests}
          placeholder="hiking, street food, trains"
          aria-describedby={err('interests') ? 'interests-error' : 'interests-hint'}
        />
        <FieldError id="interests-error" message={err('interests')} />
        {!err('interests') && (
          <p id="interests-hint" className="text-sm text-muted-foreground">
            Comma separated, up to {MAX_INTERESTS}. Shown on your public profile.
          </p>
        )}
      </div>

      <SubmitButton />
    </form>
  )
}
