import { resolveVoiceSearchLang } from "@/lib/voice-search-lang"

type SpeechCapture = {
  stop: () => void
  supported: boolean
}

type SpeechResultEvent = {
  resultIndex: number
  results: ArrayLike<{ 0?: { transcript?: string }; isFinal?: boolean }>
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

export function speechCaptureSupported() {
  if (typeof window === "undefined") return false
  const voiceWindow = window as SpeechWindow
  return Boolean(voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition)
}

export function startSpeechCapture(
  onTranscript: (transcript: string) => void,
  options?: {
    onEnd?: () => void
    onError?: () => void
  },
): SpeechCapture {
  const voiceWindow = window as SpeechWindow
  const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition
  if (!Recognition) {
    return { supported: false, stop: () => undefined }
  }

  const recognition = new Recognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = resolveVoiceSearchLang(typeof navigator !== "undefined" ? navigator.language : null)
  recognition.maxAlternatives = 1
  recognition.onresult = (event) => {
    const parts: string[] = []
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index]?.[0]?.transcript?.trim()
      if (transcript) parts.push(transcript)
    }
    if (parts.length) onTranscript(parts.join(" "))
  }
  recognition.onerror = () => {
    options?.onError?.()
  }
  recognition.onend = () => {
    options?.onEnd?.()
  }
  recognition.start()

  return {
    supported: true,
    stop: () => {
      try {
        recognition.stop()
      } catch {
        // Ignore duplicate stop calls from recorder teardown.
      }
    },
  }
}
