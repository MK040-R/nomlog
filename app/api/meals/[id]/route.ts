import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/meals/:id  → remove one of the user's meals (RLS scopes it to them).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('meal_logs').delete().eq('id', id)

  if (error) {
    console.error('meals DELETE failed:', error)
    return NextResponse.json({ error: 'Could not delete that meal.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
