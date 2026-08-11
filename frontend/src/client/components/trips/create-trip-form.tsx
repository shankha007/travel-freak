'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { createTrip, type CreateTripState } from '@/server/actions/trips'
import { TRIP_STATUSES, TRIP_TYPES, VISIBILITIES, suggestStatus } from '@/shared/validation/trip'
import { ALL_COUNTRIES, countryFlag, countryName } from '@/shared/geo/countries'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Textarea } from '@/client/components/ui/textarea'
import { Card, CardContent } from '@/client/components/ui/card'
import { Badge } from '@/client/components/ui/badge'
import { cn } from '@/shared/utils'

const initialState: CreateTripState = { error: null }

const STEPS = [
  { id: 'basics', label: 'Basics' },
  { id: 'dates', label: 'Dates' },
  { id: 'places', label: 'Places' },
  { id: 'review', label: 'Visibility' },
] as const

interface PlaceDraft {
  key: string
  countryCode: string
  regionCode: string
  cityName: string
}

function emptyPlace(): PlaceDraft {
  return {
    key: Math.random().toString(36).slice(2),
    countryCode: '',
    regionCode: '',
    cityName: '',
  }
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Creating…' : 'Create trip'}
    </Button>
  )
}

/**
 * Multi-step create-trip flow: basics → dates → places → visibility.
 *
 * All state is held client-side and submitted once at the end as a single JSON
 * payload, so a half-finished wizard never writes a partial trip. Steps are
 * navigation only — the server re-validates the whole payload regardless of
 * which steps the user actually visited.
 */
export function CreateTripForm({
  tripsUsed,
  tripLimit,
}: {
  tripsUsed: number
  tripLimit: number | null
}) {
  const [state, formAction] = useActionState(createTrip, initialState)
  const [step, setStep] = useState(0)

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [tripType, setTripType] = useState<string>('solo')
  const [travelerCount, setTravelerCount] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusTouched, setStatusTouched] = useState(false)
  const [status, setStatus] = useState<string>('planning')
  const [visibility, setVisibility] = useState<string>('private')
  const [budget, setBudget] = useState('')
  const [places, setPlaces] = useState<PlaceDraft[]>([emptyPlace()])

  // Derived unless the user has overridden it — someone logging last year's
  // trip should not have to fight the form, but the common case is automatic.
  const effectiveStatus = statusTouched ? status : suggestStatus(startDate || null, endDate || null)

  const validPlaces = places.filter((p) => p.countryCode !== '')

  const payload = useMemo(
    () =>
      JSON.stringify({
        title,
        summary,
        tripType: tripType || null,
        travelerCount,
        startDate,
        endDate,
        status: effectiveStatus,
        visibility,
        budgetPlanned: budget,
        currency: 'INR',
        places: validPlaces.map((p) => ({
          countryCode: p.countryCode,
          regionCode: p.regionCode,
          cityName: p.cityName,
        })),
      }),
    [
      title,
      summary,
      tripType,
      travelerCount,
      startDate,
      endDate,
      effectiveStatus,
      visibility,
      budget,
      validPlaces,
    ]
  )

  const stepValid = [
    title.trim().length > 0,
    !startDate || !endDate || endDate >= startDate,
    validPlaces.length > 0,
    true,
  ]

  const err = (path: string) => state.fieldErrors?.[path]

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      {/* Step indicator */}
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors',
                i === step
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={i === step ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums',
                  i === step ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
              >
                {i + 1}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <span className="text-muted-foreground" aria-hidden>
                ›
              </span>
            )}
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="space-y-4 p-5">
          {/* ---------------------------------------------------- basics */}
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ladakh on two wheels"
                  aria-invalid={Boolean(err('title'))}
                  autoFocus
                />
                {err('title') && <p className="text-sm text-destructive">{err('title')}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  placeholder="A sentence you will be glad to read in five years."
                />
                <p className="text-xs text-muted-foreground">{summary.length}/500</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tripType">Trip type</Label>
                  <select
                    id="tripType"
                    value={tripType}
                    onChange={(e) => setTripType(e.target.value)}
                    className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  >
                    {TRIP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t[0].toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="travelerCount">Travellers</Label>
                  <Input
                    id="travelerCount"
                    type="number"
                    min={1}
                    max={50}
                    value={travelerCount}
                    onChange={(e) => setTravelerCount(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* ----------------------------------------------------- dates */}
          {step === 1 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    aria-invalid={Boolean(err('endDate')) || !stepValid[1]}
                  />
                  {!stepValid[1] && (
                    <p className="text-sm text-destructive">
                      The end date cannot be before the start date.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={effectiveStatus}
                  onChange={(e) => {
                    setStatusTouched(true)
                    setStatus(e.target.value)
                  }}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                >
                  {TRIP_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
                {!statusTouched && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="size-3" aria-hidden />
                    Set from your dates. Change it if that is wrong.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Completed paints green on the globe, ongoing blue, anything else yellow.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Planned budget (INR)</Label>
                <Input
                  id="budget"
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </>
          )}

          {/* ---------------------------------------------------- places */}
          {step === 2 && (
            <>
              <div className="space-y-1">
                <p className="text-sm font-medium">Where did you go?</p>
                <p className="text-sm text-muted-foreground">
                  Each place fills in a country on your globe. City is optional but makes the region
                  modal much better.
                </p>
              </div>

              <ul className="space-y-3">
                {places.map((place, i) => (
                  <li key={place.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-1">
                      <Label htmlFor={`country-${place.key}`} className="text-xs">
                        Country
                      </Label>
                      <select
                        id={`country-${place.key}`}
                        value={place.countryCode}
                        onChange={(e) =>
                          setPlaces((prev) =>
                            prev.map((p, j) =>
                              j === i ? { ...p, countryCode: e.target.value } : p
                            )
                          )
                        }
                        className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                      >
                        <option value="">Select a country…</option>
                        {ALL_COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`city-${place.key}`} className="text-xs">
                        City
                      </Label>
                      <Input
                        id={`city-${place.key}`}
                        value={place.cityName}
                        onChange={(e) =>
                          setPlaces((prev) =>
                            prev.map((p, j) => (j === i ? { ...p, cityName: e.target.value } : p))
                          )
                        }
                        placeholder="Optional"
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove place ${i + 1}`}
                        disabled={places.length === 1}
                        onClick={() => setPlaces((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPlaces((prev) => [...prev, emptyPlace()])}
              >
                <Plus className="size-4" aria-hidden />
                Add another place
              </Button>

              {err('places') && <p className="text-sm text-destructive">{err('places')}</p>}

              <p className="text-xs text-muted-foreground">
                A map picker with search and coordinates comes with the world map screen. For now
                country and city are enough to paint the globe.
              </p>
            </>
          )}

          {/* ---------------------------------------------------- review */}
          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="visibility">Who can see this?</Label>
                <select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                >
                  {VISIBILITIES.map((v) => (
                    <option key={v} value={v}>
                      {v[0].toUpperCase() + v.slice(1)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {visibility === 'private' && 'Only you. This is the default.'}
                  {visibility === 'unlisted' && 'Anyone with the link, once you share one.'}
                  {visibility === 'public' &&
                    'Visible on your public profile and to search engines.'}
                </p>
              </div>

              <div className="rounded-lg border p-4 text-sm">
                <p className="mb-2 font-medium">{title || 'Untitled trip'}</p>
                <dl className="grid gap-1 text-muted-foreground">
                  <div className="flex gap-2">
                    <dt>Dates</dt>
                    <dd className="text-foreground">
                      {startDate || endDate ? `${startDate || '?'} → ${endDate || '?'}` : 'Not set'}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>Status</dt>
                    <dd className="text-foreground capitalize">{effectiveStatus}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>Travellers</dt>
                    <dd className="text-foreground">{travelerCount}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>Places</dt>
                    <dd className="flex flex-wrap gap-1 text-foreground">
                      {validPlaces.length ? (
                        validPlaces.map((p, i) => (
                          <Badge key={i} variant="secondary">
                            {countryFlag(p.countryCode)} {p.cityName || countryName(p.countryCode)}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-destructive">None — go back and add one</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </>
          )}

          {/* Errors from the server, shown on every step so they cannot be missed. */}
          {state.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="space-y-2">
                <p>{state.error}</p>
                {state.quotaExceeded && (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/settings" />}
                  >
                    See plans
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>

        <div className="flex items-center gap-3">
          {tripLimit !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {tripsUsed}/{tripLimit} trips used
            </span>
          )}

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!stepValid[step]}
            >
              Next
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <SubmitButton disabled={!title.trim() || validPlaces.length === 0} />
          )}
        </div>
      </div>
    </form>
  )
}
