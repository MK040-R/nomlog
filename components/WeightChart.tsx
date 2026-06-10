'use client'

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

type Point = { label: string; weight: number }

export function WeightChart({ data }: { data: Point[] }) {
  const weights = data.map((d) => d.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const pad = Math.max(1, (max - min) * 0.4)

  return (
    <div style={{ width: '100%', height: 150 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 6 }}>
          <defs>
            <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4E33" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#FF4E33" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9C8676' }}
            dy={6}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={[min - pad, max + pad]} />
          <Area
            type="monotone"
            dataKey="weight"
            stroke="#FF4E33"
            strokeWidth={2.5}
            fill="url(#weightFill)"
            dot={false}
            activeDot={{ r: 5, fill: '#FFFBF5', stroke: '#FF4E33', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
