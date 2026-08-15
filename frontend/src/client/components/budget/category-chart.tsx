'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CategoryTotal } from '@/shared/budget'
import { formatMoney } from '@/shared/budget'

/**
 * Where the money went, for one currency — screen 22.
 *
 * Horizontal bars rather than a pie: the question being asked is "which of
 * these is biggest, and by how much", and a length answers that where an angle
 * does not. Categories are already ranked by `summariseBudget()`, so the chart
 * reads top to bottom in order.
 *
 * Colours come from `--chart-1`…`--chart-5`, so the chart retunes with the
 * theme picker like every other chart in the app. Six categories over five
 * variables means one repeat, which is fine — the labels carry the identity,
 * the colour is only there to separate adjacent bars.
 */

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

interface TooltipEntry {
  payload?: CategoryTotal
}

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  currency: string
}) {
  const entry = payload?.[0]?.payload
  if (!active || !entry) return null

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{entry.label}</p>
      <p className="text-muted-foreground tabular-nums">
        {formatMoney(entry.total, currency)} · {entry.percent}%
      </p>
      <p className="text-xs text-muted-foreground">
        {entry.count} {entry.count === 1 ? 'entry' : 'entries'}
      </p>
    </div>
  )
}

export function CategoryChart({
  categories,
  currency,
}: {
  categories: CategoryTotal[]
  currency: string
}) {
  // `min-w-0` is load-bearing inside a grid: without it the responsive
  // container measures the space it has, draws itself that wide, and the
  // measurement grows the column until the page scrolls sideways.
  return (
    <div className="w-full min-w-0" style={{ height: Math.max(140, categories.length * 44) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={categories}
          layout="vertical"
          margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<ChartTooltip currency={currency} />}
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {categories.map((category, index) => (
              <Cell key={category.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
