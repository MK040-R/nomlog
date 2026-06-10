'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

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
      className="text-muted-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
    >
      <X className="h-3.5 w-3.5" strokeWidth={1.5} />
    </button>
  )
}
