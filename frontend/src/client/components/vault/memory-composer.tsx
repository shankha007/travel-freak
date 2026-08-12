'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Plus } from 'lucide-react'
import { addMemory } from '@/server/actions/media'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Textarea } from '@/client/components/ui/textarea'

const KINDS = [
  { value: 'note', label: 'Note' },
  { value: 'quote', label: 'Quote' },
  { value: 'favorite_location', label: 'Favourite spot' },
] as const

/**
 * Adds a text memory to the trip.
 *
 * Unlimited on every plan, so there is no quota to check and no reason to make
 * it feel expensive: one box, one date, done.
 */
export function MemoryComposer({ tripId }: { tripId: string }) {
  const router = useRouter()
  const [kind, setKind] = useState<string>('note')
  const [body, setBody] = useState('')
  const [happenedAt, setHappenedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)

    const result = await addMemory({
      tripId,
      kind: kind as 'note' | 'quote' | 'favorite_location',
      body,
      happenedAt: happenedAt || null,
    })

    setSaving(false)

    if (!result.ok) {
      setError(result.error ?? 'Could not save that note.')
      return
    }

    setBody('')
    setHappenedAt('')
    router.refresh()
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="space-y-2">
        <Label htmlFor="memoryBody">Write something down</Label>
        <Textarea
          id="memoryBody"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="The dhaba before Pang serves the best rajma of the trip. No sign, blue tarp."
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="memoryKind" className="text-xs">
            Kind
          </Label>
          <select
            id="memoryKind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-9 rounded-lg border bg-background px-3 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="memoryDate" className="text-xs">
            When
          </Label>
          <Input
            id="memoryDate"
            type="date"
            value={happenedAt}
            onChange={(e) => setHappenedAt(e.target.value)}
            className="w-40"
          />
        </div>

        <Button
          size="sm"
          className="ml-auto"
          onClick={() => void submit()}
          disabled={saving || body.trim().length === 0}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          Add
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
