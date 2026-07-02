'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

type Step = 'splash' | 'value' | 'nudge' | 'start'
type Nudge = 'morning' | 'evening' | 'none'

const SLIDES = [
  { eyebrow: 'Voice-first', title: 'Just say it.', body: 'Log a meal by talking. No menus, no scales, no math.', cta: 'Next' },
  { eyebrow: 'Smart estimates', title: 'We do the maths.', body: 'Calories and macros estimated from your words.', cta: 'Next' },
  { eyebrow: 'Honest insights', title: 'See your week.', body: 'Patterns, streaks, gentle nudges — no shame.', cta: "I'm in" },
]

const NUDGES: { key: Nudge; title: string; sub: string }[] = [
  { key: 'morning', title: 'Morning check-in', sub: 'A gentle ping at 9am' },
  { key: 'evening', title: 'Evening recap', sub: 'Wrap your day at 9pm' },
  { key: 'none', title: 'Leave me alone', sub: 'No notifications, ever' },
]

export function OnboardingFlow() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('splash')
  const [slide, setSlide] = useState(0)
  const [nudge, setNudge] = useState<Nudge | null>(null)
  const [ready, setReady] = useState(false)

  // Returning visitors skip straight to sign-in.
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('nomlog_onboarded')) {
      router.replace('/login')
      return
    }
    setReady(true)
  }, [router])

  // Splash auto-advances to the value intro.
  useEffect(() => {
    if (step !== 'splash' || !ready) return
    const t = setTimeout(() => setStep('value'), 1500)
    return () => clearTimeout(t)
  }, [step, ready])

  function finish() {
    if (nudge) localStorage.setItem('nomlog_nudge', nudge)
    localStorage.setItem('nomlog_onboarded', '1')
    router.push('/login')
  }

  if (!ready) return <Shell><Wordmark /></Shell>

  // ---- 01 Splash ----
  if (step === 'splash') {
    return (
      <Shell onClick={() => setStep('value')}>
        <Wordmark />
      </Shell>
    )
  }

  // ---- 02 Value intro (3 slides) ----
  if (step === 'value') {
    const s = SLIDES[slide]
    const last = slide === SLIDES.length - 1
    return (
      <Shell>
        <div className="flex w-full items-center justify-end pt-2">
          <button onClick={finish} className="text-[13px] font-medium text-muted-foreground transition-opacity hover:opacity-70">
            Skip
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="sticker mb-6">{s.eyebrow}</span>
          <h1 className="font-display text-[40px] font-black leading-[1.05] tracking-tight text-foreground">{s.title}</h1>
          <p className="mt-4 max-w-[280px] text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
        </div>
        <div className="flex flex-col items-center gap-6 pb-4">
          <div className="flex gap-2">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className="h-2 rounded-full transition-all"
                style={{
                  width: i === slide ? 22 : 8,
                  backgroundColor: i === slide ? 'var(--color-primary)' : 'color-mix(in oklab, var(--color-ink) 20%, transparent)',
                }}
              />
            ))}
          </div>
          <button
            onClick={() => (last ? setStep('nudge') : setSlide((n) => n + 1))}
            className="btn-primary w-full max-w-[320px]"
          >
            {s.cta}
          </button>
        </div>
      </Shell>
    )
  }

  // ---- 03 Nudge preference ----
  if (step === 'nudge') {
    return (
      <Shell>
        <div className="flex w-full items-center justify-between pt-2">
          <span />
          <span className="eyebrow">3 of 4</span>
        </div>
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="font-display text-[30px] font-black leading-tight tracking-tight text-foreground">
            When should we nudge you?
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">Pick one. You can change it later.</p>
          <div className="mt-7 flex flex-col gap-3">
            {NUDGES.map((n) => {
              const selected = nudge === n.key
              return (
                <button
                  key={n.key}
                  onClick={() => setNudge(n.key)}
                  className="chunk flex items-center justify-between px-5 py-4 text-left transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                  style={selected ? { borderColor: 'var(--color-primary)', boxShadow: '6px 6px 0 0 var(--color-primary)' } : undefined}
                >
                  <span>
                    <span className="block font-display text-[17px] font-bold text-foreground">{n.title}</span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">{n.sub}</span>
                  </span>
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[2.5px]"
                    style={{
                      borderColor: selected ? 'var(--color-primary)' : 'color-mix(in oklab, var(--color-ink) 30%, transparent)',
                      backgroundColor: selected ? 'var(--color-primary)' : 'transparent',
                    }}
                  >
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6.5L5 9l4.5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="pb-4">
          <button onClick={() => setStep('start')} disabled={!nudge} className="btn-primary w-full">
            Continue
          </button>
        </div>
      </Shell>
    )
  }

  // ---- 04 Start NomLog ----
  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Image src="/brand/logo-mascot.png" alt="" width={112} height={112} priority className="mb-8 h-28 w-28 object-contain" />
        <h1 className="font-display text-[40px] font-black leading-[1.05] tracking-tight text-foreground">
          Ready when
          <br />
          you are.
        </h1>
        <p className="mt-4 max-w-[260px] text-[15px] leading-relaxed text-muted-foreground">
          First log in under 10 seconds. Promise.
        </p>
      </div>
      <div className="pb-4">
        <button onClick={finish} className="btn-primary w-full">
          Start nomlog
        </button>
      </div>
    </Shell>
  )
}

function Shell({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <main
      onClick={onClick}
      className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col bg-background px-6 pb-8"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      {children}
    </main>
  )
}

function Wordmark() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <Image src="/brand/nomlog-wordmark.png" alt="nomlog" width={220} height={220} priority className="h-auto w-[220px] max-w-[60%] object-contain" />
    </div>
  )
}
