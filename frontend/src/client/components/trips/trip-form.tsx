'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { createTrip, updateTrip, type CreateTripState } from '@/server/actions/trips'
import { TRIP_STATUSES, TRIP_TYPES, VISIBILITIES, suggestStatus } from '@/shared/validation/trip'
import { ALL_COUNTRIES, countryFlag, countryName } from '@/shared/geo/countries'
import { formatLngLat } from '@/shared/geo/point'
import { PlacePicker } from '@/client/components/trips/place-picker'
import { CoverPicker, type CoverOption } from '@/client/components/trips/cover-picker'
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
  // §5 of the plan puts `cover` here, between places and visibility, and it was
  // the one step never built. It is shown on both modes so the wizard has the
  // same shape either way — on create it explains why it is empty rather than
  // being hidden, which would make the step numbers change between modes.
  { id: 'cover', label: 'Cover' },
  { id: 'review', label: 'Visibility' },
] as const

interface PlaceDraft {
  key: string
  /** Set for places that already exist, so an edit updates rather than replaces. */
  id?: string
  countryCode: string
  regionCode: string
  cityName: string
  /** Set from the map picker. Null means the place has no pin, which is allowed. */
  lng: number | null
  lat: number | null
}

function emptyPlace(): PlaceDraft {
  return {
    key: Math.random().toString(36).slice(2),
    countryCode: '',
    regionCode: '',
    cityName: '',
    lng: null,
    lat: null,
  }
}

/** The stored trip, in the shape the form edits. */
export interface TripFormInitial {
  title: string
  summary: string
  tripType: string
  travelerCount: string
  startDate: string
  endDate: string
  status: string
  visibility: string
  budgetPlanned: string
  places: {
    id: string
    countryCode: string
    regionCode: string
    cityName: string
    lng: number | null
    lat: number | null
  }[]
}

function SubmitButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : label}
    </Button>
  )
}

/**
 * Multi-step trip form: basics → dates → places → visibility.
 *
 * All state is held client-side and submitted once at the end as a single JSON
 * payload, so a half-finished wizard never writes a partial trip. Steps are
 * navigation only — the server re-validates the whole payload regardless of
 * which steps the user actually visited.
 *
 * Create and edit share this component because they submit identical fields.
 * Only the action, the labels and the starting values differ; keeping one form
 * means a field added to a trip cannot be added to one path and forgotten on
 * the other.
 */
export function TripForm({
  mode = 'create',
  tripId,
  initial,
  tripsUsed,
  tripLimit,
  defaultVisibility = 'private',
  photos = [],
  coverId = null,
}: {
  mode?: 'create' | 'edit'
  tripId?: string
  initial?: TripFormInitial
  tripsUsed?: number
  tripLimit?: number | null
  /**
   * What a new trip starts as, from `profiles.default_trip_visibility` — the
   * setting on `/settings`. Only consulted when creating: an existing trip's
   * visibility is a stored fact, and re-deriving it from a preference changed
   * afterwards would republish something on the next save.
   */
  defaultVisibility?: string
  /** The trip's own photographs, for the cover step. Empty while creating. */
  photos?: CoverOption[]
  /** The cover already chosen, if any. */
  coverId?: string | null
}) {
  const isEdit = mode === 'edit'
  const [state, formAction] = useActionState(isEdit ? updateTrip : createTrip, initialState)
  const [step, setStep] = useState(0)

  const [title, setTitle] = useState(initial?.title ?? '')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [tripType, setTripType] = useState<string>(initial?.tripType || 'solo')
  const [travelerCount, setTravelerCount] = useState(initial?.travelerCount ?? '1')
  const [startDate, setStartDate] = useState(initial?.startDate ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  // An existing trip's status is a stored fact, not something to re-derive from
  // its dates — a completed trip stays completed.
  const [statusTouched, setStatusTouched] = useState(isEdit)
  const [status, setStatus] = useState<string>(initial?.status ?? 'planning')
  const [visibility, setVisibility] = useState<string>(initial?.visibility ?? defaultVisibility)
  const [budget, setBudget] = useState(initial?.budgetPlanned ?? '')
  const [places, setPlaces] = useState<PlaceDraft[]>(
    initial?.places.length ? initial.places.map((p) => ({ key: p.id, ...p })) : [emptyPlace()]
  )
  /** Key of the place whose map picker is open, or null. One at a time. */
  const [pickerFor, setPickerFor] = useState<string | null>(null)

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
          id: p.id,
          countryCode: p.countryCode,
          regionCode: p.regionCode,
          cityName: p.cityName,
          lng: p.lng,
          lat: p.lat,
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

  const picking = places.find((p) => p.key === pickerFor) ?? null

  /** Applies a picked pin to one place, filling in what it can. */
  const applyPin = (
    key: string,
    pick: { lng: number; lat: number; countryCode: string | null; cityName: string | null }
  ) =>
    setPlaces((prev) =>
      prev.map((p) =>
        p.key === key
          ? {
              ...p,
              lng: pick.lng,
              lat: pick.lat,
              // The map knows the country under the pin, and a search result
              // knows the city. Neither overwrites something already typed —
              // the writer's own words win over a provider's.
              countryCode: p.countryCode || (pick.countryCode ?? ''),
              cityName: p.cityName || (pick.cityName ?? ''),
            }
          : p
      )
    )

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />
      {isEdit && tripId && <input type="hidden" name="tripId" value={tripId} />}

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

              <ul className="space-y-4">
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

                    {/* The pin. Optional, and the copy says what it buys rather
                        than nagging: an unpinned place still paints the globe. */}
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPickerFor(place.key)}
                      >
                        <MapPin className="size-3.5" aria-hidden />
                        {hasPin(place) ? 'Move pin' : 'Set on map'}
                      </Button>

                      {hasPin(place) ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatLngLat({ lng: place.lng as number, lat: place.lat as number })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No coordinates — distance stays unmeasured
                        </span>
                      )}
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
              {err('places.0.lat') && (
                <p className="text-sm text-destructive">{err('places.0.lat')}</p>
              )}

              <p className="text-xs text-muted-foreground">
                Pins are optional. With them, the trip gets a measured distance and its photos can
                be matched to places; without them, the country still fills in.
              </p>
            </>
          )}

          {/* ----------------------------------------------------- cover */}
          {step === 3 && (
            <>
              {isEdit && tripId ? (
                <CoverPicker tripId={tripId} photos={photos} coverId={coverId} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  A cover is chosen from the trip&rsquo;s own photographs, so there is nothing to
                  choose from yet. Save the trip, add photos to its vault, and this step will offer
                  them.
                </p>
              )}
            </>
          )}

          {/* ---------------------------------------------------- review */}
          {step === 4 && (
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
                    render={<Link href="/pricing" />}
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
          {!isEdit && tripLimit != null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {tripsUsed}/{tripLimit} trips used
            </span>
          )}

          {step < STEPS.length - 1 && (
            <Button
              type="button"
              variant={isEdit ? 'outline' : 'default'}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!stepValid[step]}
            >
              Next
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}

          {/* Editing shows Save on every step: someone fixing a typo in the
              title should not have to walk to the end of the wizard. Creating
              keeps it on the last step, where the review summary is. */}
          {(isEdit || step === STEPS.length - 1) && (
            <SubmitButton
              disabled={!title.trim() || validPlaces.length === 0}
              label={isEdit ? 'Save changes' : 'Create trip'}
            />
          )}
        </div>
      </div>

      {/* One picker for the whole list. Rendering it per row would mount a
          MapLibre instance per place, which is a lot of WebGL for one dialog. */}
      {picking && (
        <PlacePicker
          open={pickerFor !== null}
          onOpenChange={(open) => !open && setPickerFor(null)}
          initial={
            picking.lng !== null && picking.lat !== null
              ? { lng: picking.lng, lat: picking.lat }
              : null
          }
          label={
            picking.cityName ||
            (picking.countryCode ? countryName(picking.countryCode) : 'this place')
          }
          onPick={(pick) => applyPin(picking.key, pick)}
          onClear={() =>
            setPlaces((prev) =>
              prev.map((p) => (p.key === picking.key ? { ...p, lng: null, lat: null } : p))
            )
          }
        />
      )}
    </form>
  )
}

/** True when a draft place carries a complete coordinate. */
function hasPin(place: PlaceDraft): boolean {
  return place.lng !== null && place.lat !== null
}
