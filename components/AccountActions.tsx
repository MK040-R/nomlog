'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function AccountActions() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function deleteAccount() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not delete your account.')
      }
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Could not delete your account.')
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={signOut}
        className="flex items-center gap-3 py-2 text-[13px] text-foreground transition-opacity hover:opacity-70"
      >
        <LogOut className="h-3.5 w-3.5 opacity-70" strokeWidth={1.5} /> Sign out
      </button>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="flex items-center gap-3 py-2 text-[13px] text-destructive transition-opacity hover:opacity-70"
        >
          <Trash2 className="h-3.5 w-3.5 opacity-70" strokeWidth={1.5} /> Delete account
        </button>
      ) : (
        <div className="flex flex-col gap-2 py-2">
          <p className="text-[13px] text-muted-foreground">
            This permanently deletes your account and all your meals and weights. It can&apos;t be undone.
          </p>
          {error && <p className="text-[13px] text-destructive">{error}</p>}
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="h-7 rounded-full px-3 text-[11px] font-medium text-muted-foreground transition-opacity hover:opacity-70"
            >
              Keep my account
            </button>
            <button
              onClick={deleteAccount}
              disabled={deleting}
              className="h-7 rounded-full px-3 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-70 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-destructive)' }}
            >
              {deleting ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
