'use client'

import dynamic from 'next/dynamic'

// Recharts is ~100 KB of client JS the pages don't need for first paint.
// These wrappers load it as a separate chunk after hydration; the fixed-height
// placeholders keep layout stable while it arrives.
export const WeightChart = dynamic(() => import('./WeightChart').then((m) => m.WeightChart), {
  ssr: false,
  loading: () => <div style={{ height: 100 }} />,
})

export const WeightCaloriesChart = dynamic(
  () => import('./WeightCaloriesChart').then((m) => m.WeightCaloriesChart),
  {
    ssr: false,
    loading: () => <div style={{ height: 120 }} />,
  }
)
