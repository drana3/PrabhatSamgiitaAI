"use client"

import { useEffect, useRef, useState } from "react"

import {
  pickVoiceTranscript,
  resolveVoiceSearchLang,
  normalizeVoiceTranscript,
} from "@/lib/voice-search-lang"

type VoiceResultEvent = {
  results: ArrayLike<{
    isFinal?: boolean
    length?: number
    0?: { transcript?: string }
    [index: number]: { transcript?: string } | undefined
  }>
}

type VoiceRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((event: VoiceResultEvent) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type VoiceRecognitionConstructor = new () => VoiceRecognition

type VoiceWindow = Window & {
  SpeechRecognition?: VoiceRecognitionConstructor
  webkitSpeechRecognition?: VoiceRecognitionConstructor
}

export type VoiceTranscript = {
  transcript: string
  language: string
  alternatives: string[]
}

function humanizeVoiceError(code?: string) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Allow microphone access to search by voice."
    case "no-speech":
      return "No speech heard. Tap Mic and try again."
    case "audio-capture":
      return "Could not reach the microphone."
    case "network":
      return "Voice search needs a network connection."
    case "aborted":
      return ""
    default:
      return "Voice search could not finish. Please try again."
  }
}

export function VoiceSearchButton({ onTranscript, compact = false }: { onTranscript: (result: VoiceTranscript) => void; compact?: boolean }) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [preview, setPreview] = useState("")
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<VoiceRecognition | null>(null)
  const finalized = useRef(false)

  useEffect(() => {
    const voiceWindow = window as VoiceWindow
    setSupported(Boolean(voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition))
    return () => {
      try {
        recognitionRef.current?.abort()
      } catch {
        // Ignore teardown races.
      }
      recognitionRef.current = null
    }
  }, [])

  function stopListening() {
    try {
      recognitionRef.current?.stop()
    } catch {
      // Ignore duplicate stops.
    }
    recognitionRef.current = null
    setListening(false)
  }

  function listen() {
    const voiceWindow = window as VoiceWindow
    const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition
    if (!Recognition) return

    if (listening) {
      stopListening()
      return
    }

    setError(null)
    setPreview("")
    finalized.current = false

    const recognition = new Recognition()
    recognitionRef.current = recognition
    // en-IN yields Romanized Indic lyrics that match the catalog; en-US / hi-IN do not.
    recognition.lang = resolveVoiceSearchLang(navigator.language)
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 3
    recognition.onresult = (event) => {
      let interim = ""
      let finalTranscript = ""
      const alternatives: string[] = []
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = normalizeVoiceTranscript(result?.[0]?.transcript ?? "")
        if (!text) continue
        if (result?.isFinal !== false) {
          finalTranscript = finalTranscript ? `${finalTranscript} ${text}` : text
          for (let alt = 1; alt < Math.min(result.length ?? 0, 3); alt += 1) {
            const option = normalizeVoiceTranscript(result[alt]?.transcript ?? "")
            if (option && option !== text) alternatives.push(option)
          }
        } else {
          interim = interim ? `${interim} ${text}` : text
        }
      }
      if (interim) setPreview(interim)
      if (finalTranscript) {
        finalized.current = true
        const transcript = pickVoiceTranscript(finalTranscript, alternatives)
        setPreview(transcript)
        onTranscript({
          transcript,
          language: resolveVoiceSearchLang(navigator.language),
          alternatives: alternatives.filter((value) => value !== transcript),
        })
      }
    }
    recognition.onerror = (event) => {
      const message = humanizeVoiceError(event.error)
      if (message) setError(message)
      setListening(false)
      recognitionRef.current = null
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }
    setListening(true)
    try {
      recognition.start()
    } catch {
      setListening(false)
      setError("Voice search could not start. Please try again.")
      recognitionRef.current = null
    }
  }

  if (!supported) return null

  return (
    <div className={compact ? "flex shrink-0 flex-col items-stretch" : "flex w-full shrink-0 flex-col gap-1 sm:w-auto"}>
      <button
        type="button"
        aria-label={listening ? "Stop listening" : "Search by voice"}
        aria-pressed={listening}
        onClick={listen}
        className={compact
          ? "shrink-0 rounded-full border border-navy-900/15 bg-white px-3 py-2 text-xs font-semibold text-navy-950"
          : "min-h-12 w-full shrink-0 rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-3 text-sm font-semibold text-navy-950 transition hover:border-gold-500"}
      >
        {listening ? "Listening…" : "Mic"}
      </button>
      {listening && preview ? (
        <p
          className={compact ? "sr-only" : "max-w-[14rem] truncate text-[10px] text-stone-600"}
          aria-live="polite"
        >
          {preview}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={compact ? "sr-only" : "max-w-[14rem] text-[10px] leading-4 text-red-700"}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
