import 'server-only'
import { cookies } from 'next/headers'
import { normalizeTz } from '@/lib/nutrition'

export const TZ_COOKIE = 'nomlog_tz'

/**
 * The user's IANA timezone, as synced into the nomlog_tz cookie by
 * <TimezoneSync/>. Falls back to Asia/Kolkata until the first sync.
 */
export async function getUserTz(): Promise<string> {
  const store = await cookies()
  return normalizeTz(decodeURIComponent(store.get(TZ_COOKIE)?.value ?? ''))
}
