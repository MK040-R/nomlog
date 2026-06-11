'use client'

import { useCallback, useRef, useState } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */

type Options = {
  /** Live transcript while speaking (committed + interim). */
  onTranscript: (text: string) => void
  /** Final transcript after the user taps stop. */
  onStop?: (finalText: string) => void
}

/**
 * Web Speech API input (lang en-IN), continuous until stopped, with the
 * auto-restart + manual-stop handling NomLog's voice flow needs.
 * Transcripts always go to the caller's text state for review — submitting
 * is the caller's explicit action, never automatic.
 */
export function useSpeechInput({ onTranscript, onStop }: Options) {
  const recognitionRef = useRef<any>(null)
  const manualStopRef = useRef(false)
  const committedRef = useRef('')
  const transcriptRef = useRef('')
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError('Voice input is not supported in this browser. Try typing instead.')
      return
    }
    setError(null)
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
      onTranscript(full)
    }

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone permission was blocked.')
        manualStopRef.current = true
        setListening(false)
      }
    }

    rec.onend = () => {
      if (manualStopRef.current) {
        setListening(false)
        onStop?.(transcriptRef.current.trim())
      } else {
        // iOS Safari ends sessions on its own — keep listening until told to stop.
        try {
          rec.start()
        } catch {
          setListening(false)
        }
      }
    }

    setListening(true)
    rec.start()
  }, [onTranscript, onStop])

  const stop = useCallback(() => {
    manualStopRef.current = true
    recognitionRef.current?.stop()
  }, [])

  return { listening, error, start, stop }
}
