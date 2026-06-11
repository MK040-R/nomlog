import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { todayYmd } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'

// POST /api/water → set today's glass count (absolute, one row per local day)
const BodySchema = z.object({
  glasses: z.number().int().min(0).max(30),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid glass count.' }, { status: 400 })

  const date = parsed.data.date ?? todayYmd(await getUserTz())
  const supabase = await createClient()
  const { error } = await supabase
    .from('water_logs')
    .upsert({ user_id: user.id, logged_on: date, glasses: parsed.data.glasses }, { onConflict: 'user_id,logged_on' })
  if (error) {
    console.error('water POST failed:', error)
    return NextResponse.json({ error: 'Could not save water.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
