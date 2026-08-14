'use client'

import { useMemo, useState } from 'react'
import { travelDaysOfYear, type AnalyticsTrip } from '@/shared/analytics'
import { cn } from '@/shared/utils'

/**
 * A year of days, one square each — screen 32.
 *
 * The familiar contribution-graph shape, and it earns its place here for the
 * same reason it does there: it is the only view that answers "when do I
 * actually go" at a glance. Seven rows of weekdays, one column per week, read
 * left to right.
 *
 * Days still ahead are drawn hollow rather than filled. A booked fortnight in
 * November is not a fortnight you have had, and a heatmap that paints them the
 * same is a heatmap that will be wrong until November.
 *
 * The squares are one `<div>` each with a `title`, plus a real summary in text
 * below — a grid of 365 unlabelled divs is a decoration to a screen reader, so
 * the months and the total are stated in prose that a reader can reach.
 */

const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Monday-first weekday index, because a travel week is not read from Sunday. */
function weekdayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7
}

export function TravelHeatmap({
  trips,
  years,
  initialYear,
}: {
  trips: AnalyticsTrip[]
  /** Years worth offering, newest first. */
  years: number[]
  initialYear: number
}) {
  const [year, setYear] = useState(initialYear)

  const days = useMemo(() => travelDaysOfYear(trips, year), [trips, year])

  const { columns, monthLabels, travelled, scheduled } = useMemo(() => {
    // Column 0 holds the first partial week, padded so 1 January lands on its
    // real weekday. Without the padding every year starts on a Monday and the
    // whole grid tells a small lie about which days are weekends.
    const first = new Date(`${year}-01-01T00:00:00Z`)
    const lead = weekdayIndex(first)

    const columns: ((typeof days)[number] | null)[][] = []
    let column: ((typeof days)[number] | null)[] = Array<null>(lead).fill(null)

    for (const day of days) {
      column.push(day)
      if (column.length === 7) {
        columns.push(column)
        column = []
      }
    }
    if (column.length > 0) columns.push([...column, ...Array<null>(7 - column.length).fill(null)])

    // One label per month, over the column its first day falls in.
    const monthLabels = MONTHS.map((label, month) => {
      const index = days.findIndex((d) => Number(d.date.slice(5, 7)) === month + 1)
      return { label, column: index === -1 ? 0 : Math.floor((index + lead) / 7) }
    })

    return {
      columns,
      monthLabels,
      travelled: days.filter((d) => d.trips > 0 && !d.scheduled).length,
      scheduled: days.filter((d) => d.scheduled).length,
    }
  }, [days, year])

  return (
    <div className="space-y-4">
      {years.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {years.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setYear(option)}
              aria-pressed={option === year}
              className={cn(
                'rounded-lg px-2.5 py-1 text-sm transition-colors',
                option === year
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="inline-flex gap-2">
          <div className="mt-5 flex flex-col gap-[3px] text-[10px] text-muted-foreground">
            {WEEKDAYS.map((label, i) => (
              <span key={i} className="h-3 leading-3">
                {label}
              </span>
            ))}
          </div>

          <div>
            <div className="relative mb-1 h-4 text-[10px] text-muted-foreground">
              {monthLabels.map(({ label, column }) => (
                <span
                  key={label}
                  className="absolute top-0"
                  style={{ left: `${column * 15}px` }}
                  aria-hidden
                >
                  {label}
                </span>
              ))}
            </div>

            <div aria-hidden className="flex gap-[3px]">
              {columns.map((week, i) => (
                <div key={i} className="flex flex-col gap-[3px]">
                  {week.map((day, j) =>
                    day === null ? (
                      <span key={j} className="size-3" />
                    ) : (
                      <span
                        key={day.date}
                        title={`${day.date}${day.trips === 0 ? '' : day.scheduled ? ' — booked' : ' — away'}`}
                        className={cn(
                          'size-3 rounded-[3px]',
                          day.trips === 0 && 'bg-muted',
                          day.trips > 0 && !day.scheduled && 'bg-[var(--chart-1)]',
                          day.trips > 1 && !day.scheduled && 'ring-1 ring-[var(--chart-5)]',
                          day.scheduled && 'border border-dashed border-[var(--chart-3)]'
                        )}
                      />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {travelled === 0 && scheduled === 0
          ? `Nothing recorded in ${year}.`
          : [
              travelled > 0 && `${travelled} ${travelled === 1 ? 'day' : 'days'} away in ${year}`,
              scheduled > 0 && `${scheduled} more booked`,
            ]
              .filter(Boolean)
              .join(', ') + '.'}
      </p>
    </div>
  )
}
