'use client'

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

type Point = { label: string; weight: number }

// Muted terracotta (--primary) and warm cream (--background) as literal OKLCH
// so Recharts can hand them straight to SVG fill/stroke.
const TERRACOTTA = 'oklch(0.605 0.115 38)'
const CREAM = 'oklch(0.975 0.012 75)'
const AXIS = 'oklch(0.48 0.022 45)'

export function WeightChart({ data }: { data: Point[] }) {
  const weights = data.map((d) => d.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const pad = Math.max(1, (max - min) * 0.4)

  return (
    <div style={{ width: '100%', height: 100 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TERRACOTTA} stopOpacity={0.14} />
              <stop offset="100%" stopColor={TERRACOTTA} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: AXIS, letterSpacing: '0.16em' }}
            dy={6}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={[min - pad, max + pad]} />
          <Area
            type="monotone"
            dataKey="weight"
            stroke={TERRACOTTA}
            strokeWidth={1.5}
            fill="url(#weightFill)"
            dot={false}
            activeDot={{ r: 3, fill: CREAM, stroke: TERRACOTTA, strokeWidth: 1.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
