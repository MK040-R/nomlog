'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[SignOutButton] signOut error:', error.message)
    }

    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: '14px',
        fontWeight: 500,
        color: '#2E2228',
        border: '1px solid #E7D6C3',
        borderRadius: '8px',
        padding: '8px 16px',
        cursor: 'pointer',
        backgroundColor: 'transparent',
        transition: 'background-color 0.15s ease',
      }}
    >
      Sign out
    </button>
  )
}
