"use client"

import { useEffect, useRef, useState } from "react"

import { speechCaptureSupported, startSpeechCapture } from "@/lib/speech-capture"

function MicIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
    </svg>
  )
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  )
}

export function VoiceQuestionButton({
  disabled = false,
  onTranscript,
  onError,
}: {
  disabled?: boolean
  onTranscript: (transcript: string) => void
  onError?: (message: string) => void
}) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const speechStop = useRef<(() => void) | null>(null)

  useEffect(() => {
    setSupported(speechCaptureSupported())
    return () => {
      speechStop.current?.()
      speechStop.current = null
    }
  }, [])

  if (!supported) return null

  function stopListening() {
    speechStop.current?.()
    speechStop.current = null
    setListening(false)
  }

  function toggleListening() {
    if (disabled) return
    if (listening) {
      stopListening()
      return
    }

    const capture = startSpeechCapture(onTranscript, {
      onEnd: () => {
        speechStop.current = null
        setListening(false)
      },
      onError: () => {
        stopListening()
        onError?.("Could not capture voice. Check microphone permission and try again.")
      },
    })

    if (!capture.supported) {
      onError?.("Voice input is not supported in this browser.")
      return
    }

    speechStop.current = capture.stop
    setListening(true)
  }

  return (
    <button
      type="button"
      aria-label={listening ? "Stop voice input" : "Ask by voice"}
      aria-pressed={listening}
      disabled={disabled}
      onClick={toggleListening}
      data-feature="ai_companion_voice"
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-sm transition disabled:opacity-50 ${listening ? "bg-navy-950 text-white" : "border border-navy-900/15 bg-white text-navy-950 hover:border-gold-500"}`}
    >
      {listening ? <StopIcon className="h-4 w-4" /> : <MicIcon className="h-5 w-5" />}
    </button>
  )
}
