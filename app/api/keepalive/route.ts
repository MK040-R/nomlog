import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Must run on every request: a prerendered/cached response would never touch
// the database, which defeats the whole point of this route.
export const dynamic = 'force-dynamic'

// GET /api/keepalive → one trivial DB query so a free-tier Supabase project
// doesn't auto-pause after a week of inactivity. Called on a schedule by
// Vercel Cron (see vercel.json). Returns no data.
export async function GET() {
  try {
    const supabase = createAdminClient()
    // A real GET (not HEAD): supabase-js reports a bodiless 404 on HEAD as
    // success, which would hide a wrong project URL.
    const { error } = await supabase.from('user_profiles').select('id').limit(1)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('keepalive failed:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
