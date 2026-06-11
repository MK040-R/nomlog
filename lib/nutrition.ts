import type { FoodItem, MealType } from '@/types/app.types'

/**
 * Sum a list of food items into meal totals.
 * Totals are the single source of truth — always derived from items, never trusted from the client.
 */
export function sumItems(items: FoodItem[]) {
  return items.reduce(
    (acc, it) => ({
      total_calories: acc.total_calories + Math.round(it.calories_kcal || 0),
      total_protein_g: round1(acc.total_protein_g + (it.protein_g || 0)),
      total_carbs_g: round1(acc.total_carbs_g + (it.carbs_g || 0)),
      total_fat_g: round1(acc.total_fat_g + (it.fat_g || 0)),
      total_fiber_g: round1(acc.total_fiber_g + (it.fiber_g || 0)),
    }),
    { total_calories: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0, total_fiber_g: 0 }
  )
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

// ---------------------------------------------------------------------------
// Timezone-aware date helpers.
// Log days run on the USER's local timezone (IANA name from the nomlog_tz
// cookie, synced by <TimezoneSync/>). Asia/Kolkata is the fallback for
// requests that arrive before the cookie exists.
// ---------------------------------------------------------------------------

export const DEFAULT_TZ = 'Asia/Kolkata'

/** A usable IANA timezone, falling back to DEFAULT_TZ for anything invalid. */
export function normalizeTz(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return DEFAULT_TZ
  }
}

/** The zone's UTC offset (ms) at a given instant — DST-aware. */
function offsetMs(tz: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** The UTC instant of local midnight on a YYYY-MM-DD in the given zone. */
function zonedMidnightUtc(ymd: string, tz: string): Date {
  const localAsUtc = new Date(ymd + 'T00:00:00Z').getTime()
  // Two passes so a DST transition between guess and answer still resolves.
  let instant = localAsUtc - offsetMs(tz, new Date(localAsUtc))
  instant = localAsUtc - offsetMs(tz, new Date(instant))
  return new Date(instant)
}

/**
 * Given an optional YYYY-MM-DD (interpreted in the user's zone), return that
 * day's UTC start/end instants for querying logged_at, plus the resolved date
 * string. Defaults to "today" in that zone. DST days (23h/25h) are handled.
 */
export function dayRange(tz: string, dateStr?: string) {
  const ymd = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayYmd(tz)
  const start = zonedMidnightUtc(ymd, tz)
  const end = zonedMidnightUtc(shiftYmd(ymd, 1), tz)
  return { ymd, startIso: start.toISOString(), endIso: end.toISOString() }
}

/** "Today" as YYYY-MM-DD in the user's zone. */
export function todayYmd(tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  )
}

/** The calendar day (YYYY-MM-DD) a given timestamp falls on in the user's zone. */
export function ymdOf(tz: string, iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso)
  )
}

/** Current hour (0-23) in the user's zone. */
export function hourNow(tz: string) {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date())
  )
}

/** Shift a YYYY-MM-DD by N days (positive or negative) — pure date math. */
export function shiftYmd(ymd: string, days: number) {
  const d = new Date(ymd + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The last N days as YYYY-MM-DD, oldest first, ending today in the user's zone. */
export function lastNDays(tz: string, n: number) {
  const today = todayYmd(tz)
  return Array.from({ length: n }, (_, i) => shiftYmd(today, -(n - 1 - i)))
}

/** Short weekday label (e.g. "Mon") for a YYYY-MM-DD. */
export function weekdayShort(ymd: string) {
  return new Date(ymd + 'T00:00:00Z').toLocaleDateString('en-IN', {
    weekday: 'short',
    timeZone: 'UTC',
  })
}

/** The meal type a fresh log most likely is, by local hour (mirrors CORR-05). */
export function mealTypeForHour(h: number): MealType {
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 19) return 'snack'
  return 'dinner'
}

/** Default goals when the user hasn't set their own yet. */
export const DEFAULT_GOALS = {
  goal_calories: 2000,
  goal_protein_g: 90,
  goal_carbs_g: 250,
  goal_fat_g: 65,
  goal_fiber_g: 30,
}
