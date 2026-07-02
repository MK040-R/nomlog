/**
 * Signature calorie ring from the nomlog design system — SVG progress ring
 * with the day's total in Fraunces at the center. Server-renderable.
 */
export function CalorieRing({
  pct,
  value,
  label,
  over = false,
  size = 168,
}: {
  pct: number
  value: string
  label: string
  over?: boolean
  size?: number
}) {
  const stroke = 12
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (Math.min(pct, 100) / 100) * c
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-ink)"
          strokeOpacity="0.12"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? 'var(--color-destructive)' : 'var(--color-tomato)'}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="num font-display text-[34px] font-black leading-none text-foreground">{value}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}
