'use client'

import { useRef, useState } from 'react'
import { fetchJson } from '@/lib/fetchJson'
import { useRouter } from 'next/navigation'
import { Mic, Square, X } from 'lucide-react'
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

// `date` (YYYY-MM-DD) logs the meal onto that past day instead of now.
export function LogMeal({ date }: { date?: string }) {
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

  const [addText, setAddText] = useState('')
  const [adding, setAdding] = useState(false)

  const recognitionRef = useRef<any>(null)
  const manualStopRef = useRef(false)
  const committedRef = useRef('')
  const transcriptRef = useRef('')
  const voiceUsedRef = useRef(false)
  const [reviewHint, setReviewHint] = useState(false)

  async function parse(input: string) {
    const clean = input.trim()
    if (!clean) return
    setStatus('parsing')
    setError(null)
    setReviewHint(false)
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
      await fetchJson('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: mealType,
          raw_input: rawInput,
          input_source: voiceUsedRef.current ? 'voice' : 'text',
          confidence,
          edited,
          items,
          date,
        }),
      })
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
    setReviewHint(false)
    voiceUsedRef.current = false
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
      voiceUsedRef.current = true
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
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone permission was blocked.')
        manualStopRef.current = true
        setListening(false)
      }
    }

    // On manual stop the transcript stays in the textarea for the user to
    // review and edit — parsing only happens when they tap "Log it".
    rec.onend = () => {
      if (manualStopRef.current) {
        setListening(false)
        if (transcriptRef.current.trim()) setReviewHint(true)
      } else {
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
      <div>
        <div className="flex items-center justify-between">
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value as MealType)}
            className="field w-auto pr-6 text-[13px] font-medium capitalize"
          >
            {MEAL_TYPES.map((m) => (
              <option key={m} value={m} className="capitalize">{m}</option>
            ))}
          </select>
          {confidence !== 'high' && (
            <span className="text-[11px] text-muted-foreground">Rough — tap a number to fix it</span>
          )}
        </div>

        <div className="mt-4 flex flex-col">
          {items.map((it, i) => (
            <div key={i} className={i > 0 ? 'border-t border-border/60 pt-3 mt-3' : ''}>
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={it.name}
                  onChange={(e) => updateItem(i, 'name', e.target.value)}
                  className="flex-1 bg-transparent font-display text-[15px] font-medium text-foreground outline-none"
                />
                <button onClick={() => removeItem(i)} className="text-muted-foreground transition-opacity hover:opacity-70" aria-label="Remove item">
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <input
                value={it.portion}
                onChange={(e) => updateItem(i, 'portion', e.target.value)}
                className="mb-3 w-full bg-transparent text-[13px] text-muted-foreground outline-none"
              />
              <div className="grid grid-cols-5 gap-3">
                {([
                  ['calories_kcal', 'kcal'],
                  ['protein_g', 'P'],
                  ['carbs_g', 'C'],
                  ['fat_g', 'F'],
                  ['fiber_g', 'Fi'],
                ] as [keyof FoodItem, string][]).map(([field, label]) => (
                  <label key={field} className="flex flex-col">
                    <span className="eyebrow mb-1 text-[9px]">{label}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={it[field] as number}
                      onChange={(e) => updateItem(i, field, e.target.value)}
                      className="num field text-[14px]"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Add more */}
        <div className="mt-4 flex items-end gap-2">
          <input
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addMore(addText)
            }}
            placeholder="add more… e.g. 2 rotis"
            disabled={adding}
            className="field flex-1"
          />
          <button
            onClick={() => addMore(addText)}
            disabled={adding || !addText.trim()}
            className="h-7 rounded-full px-3 text-[11px] font-medium text-primary transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            {adding ? '…' : 'Add'}
          </button>
        </div>
        <button
          onClick={() => {
            setEdited(true)
            setItems((prev) => [...prev, { ...BLANK }])
          }}
          className="mt-2 text-[11px] font-medium text-muted-foreground transition-opacity hover:opacity-70"
        >
          + add an item by hand
        </button>

        <div className="mt-5 flex items-baseline justify-between">
          <span className="eyebrow">Total</span>
          <span className="num text-[22px] font-medium text-foreground">{Math.round(totals.kcal)} kcal</span>
        </div>
        <p className="num mt-1 text-right text-[11px] text-muted-foreground">
          P {totals.p.toFixed(0)} · C {totals.c.toFixed(0)} · F {totals.f.toFixed(0)} · Fi {totals.fib.toFixed(0)}
        </p>

        {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button onClick={reset} disabled={status === 'saving'} className="btn-ghost flex-1">
            Cancel
          </button>
          <button onClick={save} disabled={status === 'saving' || items.length === 0} className="btn-primary flex-1">
            {status === 'saving' ? 'Saving…' : 'Save meal'}
          </button>
        </div>
      </div>
    )
  }

  // ---- Idle / parsing ----
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-[0_2px_16px_rgba(120,80,60,0.06)]">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) parse(text)
        }}
        placeholder="What did you eat? e.g. two rotis, dal, a bowl of curd"
        rows={2}
        disabled={status === 'parsing'}
        className="w-full resize-none bg-transparent text-[16px] leading-snug text-foreground outline-none placeholder:text-muted-foreground"
      />

      {listening && <p className="mt-2 text-[13px] text-primary">Listening… tap stop when you&apos;re done.</p>}
      {!listening && reviewHint && (
        <p className="mt-2 text-[13px] text-muted-foreground">Got it — check the text, then tap Log it.</p>
      )}
      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => (listening ? stopVoice() : startVoice())}
          disabled={status === 'parsing'}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-opacity hover:opacity-70 ${
            listening ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground'
          }`}
          aria-label={listening ? 'Stop listening' : 'Speak your meal'}
        >
          {listening ? <Square className="h-4 w-4" strokeWidth={2} /> : <Mic className="h-5 w-5" strokeWidth={1.5} />}
        </button>
        <button
          onClick={() => parse(text)}
          disabled={status === 'parsing' || !text.trim() || listening}
          className="btn-primary h-12 flex-1 text-[15px]"
        >
          {status === 'parsing' ? 'Reading…' : 'Log it'}
        </button>
      </div>
    </div>
  )
}

async function callParse(text: string): Promise<Parsed> {
  return fetchJson<Parsed>('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}
