'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteMealButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function remove() {
    setBusy(true)
    try {
      const res = await fetch(`/api/meals/${id}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
      else setBusy(false)
    } catch {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      aria-label="Delete meal"
      className="text-text-subtle transition hover:text-primary disabled:opacity-40"
    >
      {busy ? '…' : '✕'}
    </button>
  )
}
