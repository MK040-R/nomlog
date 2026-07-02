'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, X } from 'lucide-react'
import type { FoodItem, MealType } from '@/types/app.types'
import { fetchJson } from '@/lib/fetchJson'
import { useSpeechInput } from '@/lib/useSpeechInput'

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
// `recentItems` powers the add-by-hand picker with foods they actually eat.
export function LogMeal({ date, recentItems = [] }: { date?: string; recentItems?: FoodItem[] }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'parsing' | 'confirming' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [items, setItems] = useState<FoodItem[]>([])
  const [mealType, setMealType] = useState<MealType>('snack')
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium')
  const [rawInput, setRawInput] = useState('')
  const [edited, setEdited] = useState(false)

  const [addText, setAddText] = useState('')
  const [adding, setAdding] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const [reviewHint, setReviewHint] = useState(false)
  const voiceUsedRef = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const voice = useSpeechInput({
    onTranscript: (t) => {
      voiceUsedRef.current = true
      setText(t)
    },
    onStop: (t) => {
      if (t) setReviewHint(true)
    },
  })

  const addVoice = useSpeechInput({
    onTranscript: (t) => {
      voiceUsedRef.current = true
      setAddText(t)
    },
  })

  // Bring the confirmation panel into view when it appears — on small
  // screens it can otherwise render below the fold.
  useEffect(() => {
    if (status === 'confirming') panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [status])

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that.')
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
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
      setStatus('confirming')
    }
  }

  function reset() {
    setText('')
    setItems([])
    setAddText('')
    setShowPicker(false)
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

  function scaleItem(i: number, factor: number) {
    setEdited(true)
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === i
          ? {
              ...it,
              calories_kcal: Math.round(it.calories_kcal * factor),
              protein_g: Math.round(it.protein_g * factor * 10) / 10,
              carbs_g: Math.round(it.carbs_g * factor * 10) / 10,
              fat_g: Math.round(it.fat_g * factor * 10) / 10,
              fiber_g: Math.round(it.fiber_g * factor * 10) / 10,
            }
          : it
      )
    )
  }

  function removeItem(i: number) {
    setEdited(true)
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addItem(item: FoodItem) {
    setEdited(true)
    setItems((prev) => [...prev, { ...item }])
    setShowPicker(false)
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
      <div ref={panelRef} className="chunk animate-pop p-4">
        <div className="flex items-center justify-between">
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value as MealType)}
            className="w-auto rounded-full border-2 border-ink bg-white px-3 py-1 pr-6 text-[13px] font-bold capitalize outline-none"
          >
            {MEAL_TYPES.map((m) => (
              <option key={m} value={m} className="capitalize">{m}</option>
            ))}
          </select>
          {confidence !== 'high' && (
            <span className="rounded-full border-2 border-ink bg-mustard px-2 py-0.5 text-[10px] font-bold text-ink">
              Rough — tap to fix
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-2xl border-2 border-ink bg-cream/60 p-3">
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
              <div className="mb-3 flex items-center gap-2">
                <input
                  value={it.portion}
                  onChange={(e) => updateItem(i, 'portion', e.target.value)}
                  className="flex-1 bg-transparent text-[13px] text-muted-foreground outline-none"
                />
                <button
                  onClick={() => scaleItem(i, 0.5)}
                  className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[10px] font-bold text-ink transition-transform active:translate-x-px active:translate-y-px"
                >
                  ×½
                </button>
                <button
                  onClick={() => scaleItem(i, 2)}
                  className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[10px] font-bold text-ink transition-transform active:translate-x-px active:translate-y-px"
                >
                  ×2
                </button>
              </div>
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
                      enterKeyHint="done"
                      onFocus={(e) => e.target.select()}
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

        {/* Add more — type or speak */}
        <div className="mt-4 flex items-end gap-2">
          <input
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addMore(addText)
            }}
            enterKeyHint="go"
            placeholder="add more… e.g. 2 rotis"
            disabled={adding}
            className="field flex-1"
          />
          <button
            onClick={() => (addVoice.listening ? addVoice.stop() : addVoice.start())}
            disabled={adding}
            aria-label={addVoice.listening ? 'Stop listening' : 'Speak to add more'}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-opacity hover:opacity-70 ${
              addVoice.listening ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
            }`}
          >
            {addVoice.listening ? <Square className="h-3 w-3" strokeWidth={2} /> : <Mic className="h-3.5 w-3.5" strokeWidth={1.5} />}
          </button>
          <button
            onClick={() => addMore(addText)}
            disabled={adding || !addText.trim()}
            className="h-7 rounded-full px-3 text-[11px] font-medium text-primary transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            {adding ? '…' : 'Add'}
          </button>
        </div>

        {/* Add by hand — recent foods first */}
        {!showPicker ? (
          <button
            onClick={() => (recentItems.length > 0 ? setShowPicker(true) : addItem(BLANK))}
            className="mt-2 text-[11px] font-medium text-muted-foreground transition-opacity hover:opacity-70"
          >
            + add an item by hand
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {recentItems.slice(0, 6).map((r, i) => (
              <button
                key={i}
                onClick={() => addItem(r)}
                className="rounded-full border-2 border-ink bg-white px-3 py-1.5 text-[12px] font-bold text-foreground transition-transform active:translate-x-px active:translate-y-px"
              >
                {r.name} <span className="num font-semibold text-muted-foreground">· {Math.round(r.calories_kcal)}</span>
              </button>
            ))}
            <button
              onClick={() => addItem(BLANK)}
              className="rounded-full border-2 border-dashed border-ink/50 px-3 py-1.5 text-[12px] font-bold text-ink/60 transition-transform active:translate-x-px active:translate-y-px"
            >
              blank item
            </button>
          </div>
        )}

        <div className="mt-5 flex items-baseline justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Total</span>
          <span className="num font-display text-[22px] font-black text-foreground">{Math.round(totals.kcal)} kcal</span>
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
    <div className="chunk p-4">
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

      {voice.listening && <p className="mt-2 text-[13px] text-primary">Listening… tap stop when you&apos;re done.</p>}
      {!voice.listening && reviewHint && (
        <p className="mt-2 text-[13px] text-muted-foreground">Got it — check the text, then tap Log it.</p>
      )}
      {saved && <p className="mt-2 text-[13px]" style={{ color: 'var(--color-success)' }}>Saved ✓</p>}
      {(error || voice.error) && <p className="mt-2 text-[13px] text-destructive">{error || voice.error}</p>}

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => (voice.listening ? voice.stop() : voice.start())}
          disabled={status === 'parsing'}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-transform active:translate-x-px active:translate-y-px ${
            voice.listening ? 'animate-pulse-ring bg-tomato text-white' : 'bg-white text-foreground'
          }`}
          aria-label={voice.listening ? 'Stop listening' : 'Speak your meal'}
        >
          {voice.listening ? <Square className="h-4 w-4" strokeWidth={2.4} /> : <Mic className="h-5 w-5" strokeWidth={2.4} />}
        </button>
        <button
          onClick={() => parse(text)}
          disabled={status === 'parsing' || !text.trim() || voice.listening}
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
