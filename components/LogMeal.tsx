'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FoodItem, MealType } from '@/types/app.types'

type Parsed = {
  meal_type: MealType
  confidence: 'high' | 'medium' | 'low'
  items: FoodItem[]
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const BLANK: FoodItem = {
  name: 'New item',
  portion: '1 serving',
  calories_kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
}

export function LogMeal() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'parsing' | 'confirming' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)

  const [items, setItems] = useState<FoodItem[]>([])
  const [mealType, setMealType] = useState<MealType>('snack')
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium')
  const [rawInput, setRawInput] = useState('')
  const [edited, setEdited] = useState(false)

  // "add more" within the confirmation card
  const [addText, setAddText] = useState('')
  const [adding, setAdding] = useState(false)

  // voice
  const recognitionRef = useRef<any>(null)
  const manualStopRef = useRef(false)
  const committedRef = useRef('')
  const transcriptRef = useRef('')

  async function parse(input: string) {
    const clean = input.trim()
    if (!clean) return
    setStatus('parsing')
    setError(null)
    try {
      const data = await callParse(clean)
      setItems(data.items)
      setMealType(data.meal_type)
      setConfidence(data.confidence)
      setRawInput(clean)
      setEdited(false)
      setStatus('confirming')
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
      setStatus('idle')
    }
  }

  async function addMore(input: string) {
    const clean = input.trim()
    if (!clean) return
    setAdding(true)
    setError(null)
    try {
      const data = await callParse(clean)
      setItems((prev) => [...prev, ...data.items])
      setRawInput((prev) => (prev ? `${prev}; ${clean}` : clean))
      setEdited(true)
      setAddText('')
    } catch (err: any) {
      setError(err.message || 'Could not add that.')
    } finally {
      setAdding(false)
    }
  }

  async function save() {
    setStatus('saving')
    setError(null)
    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: mealType,
          raw_input: rawInput,
          input_source: 'text',
          confidence,
          edited,
          items,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save.')
      reset()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Could not save.')
      setStatus('confirming')
    }
  }

  function reset() {
    setText('')
    setItems([])
    setAddText('')
    setStatus('idle')
    setError(null)
  }

  function updateItem(i: number, field: keyof FoodItem, value: string) {
    setEdited(true)
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it
        if (field === 'name' || field === 'portion') return { ...it, [field]: value }
        return { ...it, [field]: Number(value) || 0 }
      })
    )
  }

  function removeItem(i: number) {
    setEdited(true)
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ---- Voice: listen continuously until the user taps stop ----
  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError('Voice input is not supported in this browser. Try typing instead.')
      return
    }
    const rec = new SR()
    recognitionRef.current = rec
    manualStopRef.current = false
    committedRef.current = ''
    transcriptRef.current = ''
    rec.lang = 'en-IN'
    rec.interimResults = true
    rec.continuous = true

    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) committedRef.current += chunk + ' '
        else interim += chunk
      }
      const full = (committedRef.current + interim).trim()
      transcriptRef.current = full
      setText(full)
    }

    rec.onerror = (e: any) => {
      // "no-speech" / "aborted" are normal during pauses — keep going unless it's fatal.
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone permission was blocked.')
        manualStopRef.current = true
        setListening(false)
      }
    }

    rec.onend = () => {
      if (manualStopRef.current) {
        setListening(false)
        const t = transcriptRef.current.trim()
        if (t) parse(t)
      } else {
        // Browser auto-stopped on a pause — restart so the user can keep talking.
        try {
          rec.start()
        } catch {
          setListening(false)
        }
      }
    }

    setListening(true)
    rec.start()
  }

  function stopVoice() {
    manualStopRef.current = true
    recognitionRef.current?.stop()
  }

  const totals = items.reduce(
    (a, it) => ({
      kcal: a.kcal + (it.calories_kcal || 0),
      p: a.p + (it.protein_g || 0),
      c: a.c + (it.carbs_g || 0),
      f: a.f + (it.fat_g || 0),
      fib: a.fib + (it.fiber_g || 0),
    }),
    { kcal: 0, p: 0, c: 0, f: 0, fib: 0 }
  )

  // ---- Confirming / saving ----
  if (status === 'confirming' || status === 'saving') {
    return (
      <div className="rounded-card border border-border-subtle bg-surface-card p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <span className="nom-eyebrow text-text-muted">Check the estimate</span>
          {confidence !== 'high' && (
            <span className="text-xs text-text-muted">Rough — tap any number to fix it</span>
          )}
        </div>

        <select
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType)}
          className="mb-4 rounded-input border border-border-default bg-surface-page px-3 py-2 text-sm font-medium capitalize text-text-strong"
        >
          {MEAL_TYPES.map((m) => (
            <option key={m} value={m} className="capitalize">{m}</option>
          ))}
        </select>

        <div className="flex flex-col gap-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-input border border-border-subtle bg-surface-page p-3">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={it.name}
                  onChange={(e) => updateItem(i, 'name', e.target.value)}
                  className="flex-1 bg-transparent font-display text-base font-semibold text-text-strong outline-none"
                />
                <button
                  onClick={() => removeItem(i)}
                  className="text-text-subtle hover:text-primary"
                  aria-label="Remove item"
                >
                  ✕
                </button>
              </div>
              <input
                value={it.portion}
                onChange={(e) => updateItem(i, 'portion', e.target.value)}
                className="mb-3 w-full bg-transparent text-sm text-text-muted outline-none"
              />
              <div className="grid grid-cols-5 gap-2">
                {([
                  ['calories_kcal', 'kcal'],
                  ['protein_g', 'protein'],
                  ['carbs_g', 'carbs'],
                  ['fat_g', 'fat'],
                  ['fiber_g', 'fiber'],
                ] as [keyof FoodItem, string][]).map(([field, label]) => (
                  <label key={field} className="flex flex-col">
                    <span className="nom-eyebrow mb-1 text-[9px] text-text-subtle">{label}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={it[field] as number}
                      onChange={(e) => updateItem(i, field, e.target.value)}
                      className="nom-data w-full rounded-md border border-border-subtle bg-surface-card px-1.5 py-1 text-sm text-text-strong outline-none focus:border-primary"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Add more to this same meal */}
        <div className="mt-3 flex gap-2">
          <input
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addMore(addText)
            }}
            placeholder="add more… e.g. 2 rotis"
            disabled={adding}
            className="flex-1 rounded-input border border-border-default bg-surface-page px-3 py-2 text-sm text-text-strong outline-none placeholder:text-text-subtle focus:border-primary"
          />
          <button
            onClick={() => addMore(addText)}
            disabled={adding || !addText.trim()}
            className="rounded-button border border-border-default bg-surface-card px-4 text-sm font-semibold text-text-body transition active:scale-95 disabled:opacity-50"
          >
            {adding ? '…' : 'Add'}
          </button>
        </div>
        <button
          onClick={() => {
            setEdited(true)
            setItems((prev) => [...prev, { ...BLANK }])
          }}
          className="mt-2 text-xs font-medium text-text-muted hover:text-primary"
        >
          + add an item by hand
        </button>

        <div className="mt-4 flex items-center justify-between rounded-input bg-surface-sunken px-4 py-3">
          <span className="text-sm font-medium text-text-body">Total</span>
          <span className="nom-data text-lg font-bold text-primary">{Math.round(totals.kcal)} kcal</span>
        </div>
        <p className="nom-data mt-2 text-center text-xs text-text-muted">
          P {totals.p.toFixed(0)}g · C {totals.c.toFixed(0)}g · F {totals.f.toFixed(0)}g · Fiber {totals.fib.toFixed(0)}g
        </p>

        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

        <div className="mt-4 flex gap-3">
          <button
            onClick={reset}
            disabled={status === 'saving'}
            className="flex-1 rounded-button border border-border-default bg-surface-card py-3 text-sm font-semibold text-text-body transition active:scale-[0.97] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={status === 'saving' || items.length === 0}
            className="google-signin-btn flex-1 disabled:opacity-60"
          >
            {status === 'saving' ? 'Saving…' : 'Save meal'}
          </button>
        </div>
      </div>
    )
  }

  // ---- Idle / parsing ----
  return (
    <div className="rounded-card border border-border-subtle bg-surface-card p-5 shadow-card">
      <label className="nom-eyebrow mb-2 block text-text-muted">What&apos;d you eat? 🍴</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) parse(text)
        }}
        placeholder="two rotis, dal, a bowl of curd…"
        rows={2}
        disabled={status === 'parsing'}
        className="w-full resize-none rounded-input border border-border-default bg-surface-page px-4 py-3 text-base text-text-strong outline-none placeholder:text-text-subtle focus:border-primary"
      />

      {listening && (
        <p className="mt-2 text-sm font-medium text-primary">Listening… tap ⏹ when you&apos;re done.</p>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-3 flex gap-3">
        <button
          onClick={() => (listening ? stopVoice() : startVoice())}
          disabled={status === 'parsing'}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-xl transition active:scale-95 ${
            listening ? 'border-primary bg-primary text-white' : 'border-border-default bg-surface-card text-text-body'
          }`}
          aria-label={listening ? 'Stop listening' : 'Speak your meal'}
        >
          {listening ? '⏹' : '🎤'}
        </button>
        <button
          onClick={() => parse(text)}
          disabled={status === 'parsing' || !text.trim() || listening}
          className="google-signin-btn flex-1 disabled:opacity-50"
        >
          {status === 'parsing' ? 'Reading…' : 'Log it'}
        </button>
      </div>
    </div>
  )
}

async function callParse(text: string): Promise<Parsed> {
  const res = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Something went wrong.')
  return data as Parsed
}
