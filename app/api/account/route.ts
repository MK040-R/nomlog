import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE /api/account — permanently delete the signed-in user and all their data.
// meal_logs, weight_logs and user_profiles cascade off auth.users on delete.
export async function DELETE() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('account delete failed:', error)
    return NextResponse.json({ error: 'Could not delete your account.' }, { status: 500 })
  }

  // Clear the session cookies for this browser.
  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
