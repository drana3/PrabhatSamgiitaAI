import { useCallback, useEffect, useRef, useState } from "react"

import {
  humanizeSpeechRecognitionError,
  isLikelyIosSimulator,
  isNativeSpeechRecognitionAvailable,
  startNativeSpeechRecognition,
  stopNativeSpeechRecognition,
} from "@/lib/speechRecognition"

type Options = {
  onPartial?: (transcript: string) => void
  onFinal?: (transcript: string) => void
  onUnavailable?: () => void
}

export function useVoiceSearch(options: Options = {}) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [listening, setListening] = useState(false)
  const [nativeAvailable, setNativeAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef<null | (() => void)>(null)

  useEffect(() => {
    setNativeAvailable(isNativeSpeechRecognitionAvailable())
    return () => {
      stopRef.current?.()
      stopRef.current = null
      stopNativeSpeechRecognition()
    }
  }, [])

  const stop = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    stopNativeSpeechRecognition()
    setListening(false)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (!isNativeSpeechRecognitionAvailable()) {
      setNativeAvailable(false)
      setError(
        "Built-in voice search needs a development build (npm run android or npm run ios). Use the keyboard mic or type your query.",
      )
      optionsRef.current.onUnavailable?.()
      return false
    }

    if (stopRef.current) {
      stop()
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    try {
      setListening(true)
      stopRef.current = await startNativeSpeechRecognition({
        onPartial: (text) => optionsRef.current.onPartial?.(text),
        onFinal: (text) => {
          optionsRef.current.onFinal?.(text)
          setListening(false)
        },
        onError: (message) => {
          if (!message) return
          setError(message)
          setListening(false)
        },
        onEnd: () => setListening(false),
      })
      return true
    } catch (err) {
      setListening(false)
      setError(
        humanizeSpeechRecognitionError(
          err instanceof Error ? err.message : "Could not start speech recognition.",
          { onSimulator: isLikelyIosSimulator() },
        ),
      )
      optionsRef.current.onUnavailable?.()
      return false
    }
  }, [stop])

  const toggle = useCallback(async () => {
    if (listening) {
      stop()
      return
    }
    await start()
  }, [listening, start, stop])

  return {
    listening,
    nativeAvailable,
    error,
    setError,
    start,
    stop,
    toggle,
  }
}
