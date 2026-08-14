'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { YearStat } from '@/shared/analytics'

/**
 * Days away per calendar year — screen 32.
 *
 * Stacked rather than side by side, because the two series answer one question:
 * how much of this year went to travel. Days taken sit at the bottom in the
 * solid colour and days still booked sit above them, distinct, so the current
 * year reads as "23 days, and 11 more in November" rather than as 34 days of a
 * life that has not been lived yet.
 *
 * The empty years come from `perYear`, which fills them in. They are the shape
 * of the chart, not gaps in it.
 */

const AXIS = 'var(--muted-foreground)'

interface TooltipEntry {
  name?: string
  value?: number | string
  color?: string
}

/** The default tooltip is a white box with a black border in every theme. */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2 text-muted-foreground">
          <span aria-hidden className="size-2 rounded-full" style={{ background: entry.color }} />
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

export function YearChart({ years }: { years: YearStat[] }) {
  // Recharts measures its own width, so the height is the only thing fixed
  // here. `min-w-0` is load-bearing: a grid or flex item is `min-width: auto`
  // by default, so the container measures the space it has, draws itself that
  // wide, and the measurement grows the column — the page ends up wider than
  // the viewport and everything on it gets a horizontal scrollbar.
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={years} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="year"
            stroke={AXIS}
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            stroke={AXIS}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
          />
          <Bar
            dataKey="days"
            name="Days away"
            stackId="days"
            fill="var(--chart-1)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="scheduledDays"
            name="Days booked"
            stackId="days"
            fill="var(--chart-3)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
