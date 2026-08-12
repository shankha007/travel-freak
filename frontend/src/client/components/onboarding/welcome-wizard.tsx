'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Globe2, Loader2, Sparkles } from 'lucide-react'
import {
  finishOnboarding,
  saveOnboardingProfile,
  saveVisitedCountries,
} from '@/server/actions/onboarding'
import { ALL_COUNTRIES } from '@/shared/geo/countries'
import { CountryTapper } from '@/client/components/onboarding/country-tapper'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Card, CardContent } from '@/client/components/ui/card'
import { cn } from '@/shared/utils'

export interface WelcomeInitial {
  username: string
  displayName: string
  countryCode: string
  city: string
  visitedCountries: string[]
}

const STEPS = [
  { id: 'you', label: 'You' },
  { id: 'countries', label: 'Your map' },
  { id: 'done', label: 'Done' },
] as const

/**
 * The onboarding wizard — screen 10.
 *
 * The middle step is the entire point: a new account's globe is grey, and the
 * fastest way to make this product make sense is to have someone tap the
 * countries they have already been to and watch it fill in. Everything else here
 * is in service of getting to that step and out of it again.
 *
 * Each step saves before advancing, so closing the tab loses nothing, and the
 * shell sends an un-onboarded user back here to resume. Only the last step sets
 * `onboarded_at` — that is what "finished" means.
 */
export function WelcomeWizard({ initial }: { initial: WelcomeInitial }) {
  const [step, setStep] = useState(0)
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [username, setUsername] = useState(initial.username)
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [countryCode, setCountryCode] = useState(initial.countryCode)
  const [city, setCity] = useState(initial.city)
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.visitedCountries))

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  async function saveProfileStep() {
    setBusy(true)
    setError(null)
    const result = await saveOnboardingProfile({ username, displayName, countryCode, city })
    setBusy(false)

    if (!result.ok) {
      setError(result.error ?? 'Could not save that.')
      setFieldErrors(result.fieldErrors ?? {})
      return
    }
    setFieldErrors({})
    setStep(1)
  }

  async function saveCountriesStep() {
    setBusy(true)
    setError(null)
    const result = await saveVisitedCountries([...selected])
    setBusy(false)

    if (!result.ok) {
      setError(result.error ?? 'Could not save your countries.')
      return
    }
    setStep(2)
  }

  return (
    <div className="w-full max-w-3xl space-y-6">
      {/* Progress. Not clickable: each step writes on the way out, so jumping
          ahead would skip a save rather than just a screen. */}
      <ol className="flex items-center gap-2 text-sm" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1',
                i === step
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground'
              )}
              aria-current={i === step ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums',
                  i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
              >
                {i + 1}
              </span>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-muted-foreground" aria-hidden>
                ›
              </span>
            )}
          </li>
        ))}
      </ol>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {/* ------------------------------------------------------------ step 1 */}
      {step === 0 && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <header className="space-y-1">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">
                Let’s set you up
              </h1>
              <p className="text-sm text-muted-foreground">
                Two questions, then the fun part. All of it is editable later.
              </p>
            </header>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={Boolean(fieldErrors.username)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Your public profile lives at /u/{username || 'you'} — if you ever make it public.
              </p>
              {fieldErrors.username && (
                <p className="text-sm text-destructive">{fieldErrors.username}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What people should call you"
                aria-invalid={Boolean(fieldErrors.displayName)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="countryCode">Where are you based?</Label>
                <select
                  id="countryCode"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="">Prefer not to say</option>
                  {ALL_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void saveProfileStep()} disabled={busy || !username.trim()}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Next
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------ step 2 */}
      {step === 1 && (
        <Card>
          <CardContent className="space-y-5 p-6">
            <header className="space-y-1">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">
                Where have you been?
              </h1>
              <p className="text-sm text-muted-foreground">
                Tap every country you have set foot in. This is your globe — you can add the trips
                behind them whenever you like.
              </p>
            </header>

            <CountryTapper
              selected={selected}
              onToggle={toggle}
              onClear={() => setSelected(new Set())}
            />

            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep(0)} disabled={busy}>
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </Button>
              <Button onClick={() => void saveCountriesStep()} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {selected.size === 0 ? 'Skip for now' : `Add ${selected.size}`}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------ step 3 */}
      {step === 2 && (
        <Card>
          <CardContent className="space-y-5 p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-globe-visited/15">
              <Globe2 className="size-6 text-globe-visited" aria-hidden />
            </div>

            <header className="space-y-1">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">
                {selected.size > 0
                  ? `${selected.size} ${selected.size === 1 ? 'country' : 'countries'} on your globe`
                  : 'Your globe is ready'}
              </h1>
              <p className="mx-auto max-w-md text-sm text-pretty text-muted-foreground">
                {selected.size > 0
                  ? 'That is your travel history, roughly. Logging a trip adds the dates, photos and stories behind a country — and the globe gets richer as you do.'
                  : 'Nothing marked yet. Log a trip whenever you are ready and your globe fills in from it.'}
              </p>
            </header>

            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button
                size="lg"
                onClick={() => startTransition(() => void finishOnboarding())}
                disabled={pending}
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                <Sparkles className="size-4" aria-hidden />
                See my globe
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Everything here is private until you say otherwise.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
