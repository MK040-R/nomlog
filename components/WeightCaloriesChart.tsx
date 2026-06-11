'use client'

import { Bar, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts'

export type WeekPoint = { label: string; weight: number | null; avgKcal: number | null }

// Literal OKLCH (Recharts hands these straight to SVG).
const TERRACOTTA = 'oklch(0.605 0.115 38)'
const MUTED = 'oklch(0.92 0.018 65)'
const AXIS = 'oklch(0.48 0.022 45)'

// Weekly average intake (bars) with the weight reading for the same week
// (line) — the "is it working?" view.
export function WeightCaloriesChart({ data }: { data: WeekPoint[] }) {
  const weights = data.map((d) => d.weight).filter((w): w is number => w !== null)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const pad = Math.max(0.5, (max - min) * 0.4)

  return (
    <div style={{ width: '100%', height: 120 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: AXIS, letterSpacing: '0.16em' }}
            dy={6}
          />
          <YAxis yAxisId="kcal" hide />
          <YAxis yAxisId="kg" hide domain={[min - pad, max + pad]} />
          <Bar yAxisId="kcal" dataKey="avgKcal" fill={MUTED} radius={[3, 3, 0, 0]} maxBarSize={26} />
          <Line
            yAxisId="kg"
            type="monotone"
            dataKey="weight"
            stroke={TERRACOTTA}
            strokeWidth={1.5}
            dot={{ r: 2.5, fill: TERRACOTTA, strokeWidth: 0 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
