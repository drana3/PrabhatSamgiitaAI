"use client"

import { useEffect, useState } from "react"

type VoiceResultEvent = {
  results: { 0?: { length?: number; [index: number]: { transcript?: string } } }
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

export type VoiceTranscript = {
  transcript: string
  language: string
  alternatives: string[]
}

const voiceLanguages = [
  ["en-IN", "English"],
  ["hi-IN", "हिन्दी"],
  ["bn-IN", "বাংলা"],
  ["ta-IN", "தமிழ்"],
  ["te-IN", "తెలుగు"],
  ["mr-IN", "मराठी"],
  ["gu-IN", "ગુજરાતી"],
  ["kn-IN", "ಕನ್ನಡ"],
  ["ml-IN", "മലയാളം"],
  ["pa-IN", "ਪੰਜਾਬੀ"],
  ["ur-IN", "اردو"],
  ["or-IN", "ଓଡ଼ିଆ"],
  ["as-IN", "অসমীয়া"],
  ["ne-NP", "नेपाली"],
] as const

export function VoiceSearchButton({ onTranscript, compact = false }: { onTranscript: (result: VoiceTranscript) => void; compact?: boolean }) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [language, setLanguage] = useState("en-IN")

  useEffect(() => {
    const voiceWindow = window as VoiceWindow
    setSupported(Boolean(voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition))
    const saved = window.localStorage.getItem("voice-search-language")
    const deviceLanguage = navigator.language || "en-IN"
    const supportedLanguage = voiceLanguages.some(([code]) => code === deviceLanguage)
    setLanguage(saved || (supportedLanguage ? deviceLanguage : "en-IN"))
  }, [])

  function listen() {
    const voiceWindow = window as VoiceWindow
    const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition
    if (!Recognition) return

    const recognition = new Recognition()
    recognition.lang = language
    recognition.interimResults = false
    recognition.maxAlternatives = 3
    recognition.onresult = (event) => {
      const result = event.results[0]
      const transcript = result?.[0]?.transcript?.trim()
      if (transcript) {
        const alternatives = Array.from(
          { length: Math.min(result?.length ?? 0, 3) },
          (_, index) => result?.[index]?.transcript?.trim() ?? "",
        ).filter((value) => value && value !== transcript)
        onTranscript({ transcript, language, alternatives })
      }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    setListening(true)
    recognition.start()
  }

  if (!supported) return null

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <label className="sr-only" htmlFor={compact ? "hero-voice-language" : "voice-language"}>Spoken language</label>
      <select
        id={compact ? "hero-voice-language" : "voice-language"}
        aria-label="Spoken language"
        value={language}
        onChange={(event) => {
          setLanguage(event.target.value)
          window.localStorage.setItem("voice-search-language", event.target.value)
        }}
        className={compact
          ? "max-w-20 rounded-full border border-navy-900/10 bg-white px-2 py-2 text-[10px] font-semibold text-navy-950 sm:max-w-24"
          : "max-w-28 rounded-xl border border-navy-900/10 bg-ivory-50 px-2 py-3 text-xs font-semibold text-navy-950"}
      >
        {voiceLanguages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
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
    </div>
  )
}
