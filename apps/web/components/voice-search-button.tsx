"use client"

import { useEffect, useState } from "react"

type VoiceResultEvent = {
  results: { 0?: { 0?: { transcript?: string } } }
}

type VoiceRecognition = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: VoiceResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
}

type VoiceRecognitionConstructor = new () => VoiceRecognition

type VoiceWindow = Window & {
  SpeechRecognition?: VoiceRecognitionConstructor
  webkitSpeechRecognition?: VoiceRecognitionConstructor
}

export function VoiceSearchButton({ onTranscript, compact = false }: { onTranscript: (transcript: string) => void; compact?: boolean }) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)

  useEffect(() => {
    const voiceWindow = window as VoiceWindow
    setSupported(Boolean(voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition))
  }, [])

  function listen() {
    const voiceWindow = window as VoiceWindow
    const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition
    if (!Recognition) return

    const recognition = new Recognition()
    recognition.lang = navigator.language || "en-IN"
    recognition.interimResults = false
    recognition.maxAlternatives = 3
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) onTranscript(transcript)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    setListening(true)
    recognition.start()
  }

  if (!supported) return null

  return (
    <button
      type="button"
      aria-label={listening ? "Listening for a song" : "Search by voice"}
      aria-pressed={listening}
      onClick={listen}
      className={compact
        ? "shrink-0 rounded-full border border-navy-900/15 bg-white px-3 py-2 text-xs font-semibold text-navy-950"
        : "shrink-0 rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-3 text-sm font-semibold text-navy-950 transition hover:border-gold-500"}
    >
      {listening ? "Listening..." : "Mic"}
    </button>
  )
}
