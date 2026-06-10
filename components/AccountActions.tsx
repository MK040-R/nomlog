'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
        className="flex items-center gap-3 py-3 text-sm font-medium text-text-body transition active:scale-[0.98]"
      >
        <span className="text-lg">⎋</span> Sign out
      </button>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="flex items-center gap-3 py-3 text-sm font-medium text-danger transition active:scale-[0.98]"
        >
          <span className="text-lg">🗑</span> Delete account
        </button>
      ) : (
        <div className="flex flex-col gap-2 py-2">
          <p className="text-sm text-text-body">
            This permanently deletes your account and all your meals and weights. This can&apos;t be undone.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="flex-1 rounded-button border border-border-default bg-surface-card py-2.5 text-sm font-semibold text-text-body"
            >
              Keep my account
            </button>
            <button
              onClick={deleteAccount}
              disabled={deleting}
              className="flex-1 rounded-button py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-danger)' }}
            >
              {deleting ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
