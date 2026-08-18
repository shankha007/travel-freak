import Link from 'next/link'
import type { AccountUsage } from '@/server/entitlements'
import { formatBytes } from '@/shared/format'
import {
  describeQuota,
  hasMeterableLines,
  quotaTone,
  usageFraction,
  type QuotaLine,
} from '@/shared/quota'
import { cn } from '@/shared/utils'

/**
 * How much of the plan is left, at the foot of the sidebar.
 *
 * A server component with no interactivity, which is why it takes the usage as
 * a prop rather than fetching: the sidebar around it is a client component, and
 * a plan meter that shipped its own query would run on every navigation.
 *
 * **Two lines, not five.** Trips and storage are the limits somebody actually
 * runs into — one walls off the create button, the other is what costs money.
 * The per-trip photo cap belongs to a trip and the sidebar does not know which
 * one you are looking at, so it is not here.
 *
 * Renders nothing on a plan with no limits at all. A column of "unlimited"
 * labels is chrome rather than information, and the person paying for the top
 * tier is the one least in need of being told about ceilings.
 */
export function QuotaMeter({ usage, className }: { usage: AccountUsage; className?: string }) {
  const lines: QuotaLine[] = [
    { label: 'Trips', used: usage.trips.used, limit: usage.trips.limit, format: String },
    {
      label: 'Storage',
      used: usage.storage.used,
      limit: usage.storage.limit,
      format: formatBytes,
    },
  ]

  if (!hasMeterableLines(lines)) return null

  // Only when something is actually tight. An upgrade link under a meter
  // reading 2 of 15 is an advertisement; under 14 of 15 it is the next step.
  const pressed = lines.some((line) => quotaTone(line.used, line.limit) !== 'ok')

  return (
    <div className={cn('space-y-2 border-t px-3 py-3', className)}>
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {usage.planName}
      </p>

      {lines.map((line) => (
        <QuotaBar key={line.label} line={line} />
      ))}

      {pressed && (
        <Link
          href="/pricing"
          className="block text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Upgrade for more
        </Link>
      )}
    </div>
  )
}

function QuotaBar({ line }: { line: QuotaLine }) {
  const fraction = usageFraction(line.used, line.limit)
  const tone = quotaTone(line.used, line.limit)
  const description = describeQuota(line)

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{line.label}</span>
        {/* The numbers are the label's value, so they are announced together
            rather than as a stray fragment after it. */}
        <span className="tabular-nums" aria-label={`${line.label}: ${description}`}>
          {description}
        </span>
      </div>

      {/* Drawn only where there is a ceiling to draw against. An unlimited line
          keeps its numbers and loses its bar, which is the honest picture. */}
      {fraction !== null && (
        <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              tone === 'full' && 'bg-destructive',
              tone === 'warn' && 'bg-amber-500',
              tone === 'ok' && 'bg-primary'
            )}
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
