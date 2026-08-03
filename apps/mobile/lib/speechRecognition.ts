/**
 * Native speech recognition via expo-speech-recognition.
 * Loaded lazily so Expo Go (no native module) does not crash on import.
 * UI falls back to keyboard dictation when unavailable.
 *
 * Keep this module free of static react-native imports so Vitest can load it.
 */

type SpeechModule = {
  isRecognitionAvailable: () => boolean
  supportsOnDeviceRecognition?: () => boolean
  requestPermissionsAsync: () => Promise<{ granted: boolean }>
  requestMicrophonePermissionsAsync?: () => Promise<{ granted: boolean }>
  getStateAsync?: () => Promise<"inactive" | "starting" | "stopping" | "recognizing">
  start: (options: Record<string, unknown>) => void
  stop: () => void
  abort: () => void
  setCategoryIOS?: (options: Record<string, unknown>) => void
  setAudioSessionActiveIOS?: (
    value: boolean,
    options?: { notifyOthersOnDeactivation?: boolean },
  ) => void
  addListener: (
    event: string,
    listener: (event: {
      results?: Array<{ transcript: string }>
      isFinal?: boolean
      message?: string
      error?: string
      code?: number
    }) => void,
  ) => { remove: () => void }
}

/** Overridable for unit tests; production uses lazy require. */
export const speechRecognitionRuntime = {
  load(): SpeechModule | null {
    try {
      // Lazy require — static import breaks Expo Go when the native module is missing.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("expo-speech-recognition") as {
        ExpoSpeechRecognitionModule?: SpeechModule
      }
      return mod.ExpoSpeechRecognitionModule ?? null
    } catch {
      return null
    }
  },
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function isLikelyIosSimulator(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native") as { Platform: { OS: string } }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require("expo-constants").default as { isDevice?: boolean }
    if (Platform.OS !== "ios") return false
    if (typeof Constants.isDevice === "boolean") return !Constants.isDevice
  } catch {
    return false
  }
  return false
}

/** Map opaque Apple / Siri speech codes to actionable copy. */
export function humanizeSpeechRecognitionError(
  raw: string | null | undefined,
  options?: { onSimulator?: boolean; code?: string | number | null },
): string {
  const message = (raw || "").trim()
  const lower = message.toLowerCase()
  const codeFromMessage = /error\s*(\d+)/i.exec(message)
  const numericCode = codeFromMessage ? Number(codeFromMessage[1]) : null
  const code = options?.code ?? numericCode
  const onSimulator = options?.onSimulator ?? false

  if (code === "aborted" || lower === "aborted") {
    return ""
  }

  if (
    code === 209 ||
    code === 203 ||
    code === 216 ||
    code === 1101 ||
    code === 1107 ||
    code === "audio-capture" ||
    code === "busy" ||
    code === "interrupted" ||
    lower.includes("kafassistanterrordomain") ||
    lower.includes("sirispeecherrordomain")
  ) {
    if (onSimulator) {
      return (
        "Couldn’t capture audio. In Simulator: I/O → Audio Input → Mac microphone, " +
        "then tap Start listening again. Pause any playing song first."
      )
    }
    return "Couldn’t capture audio. Pause any playing song, tap Start listening, and speak clearly — or type below."
  }

  if (code === 1110 || code === "no-speech" || lower.includes("no speech")) {
    return "No speech detected. Tap Start listening and speak a song number or theme."
  }

  if (
    code === "not-allowed" ||
    lower.includes("permission") ||
    lower.includes("not authorized") ||
    lower.includes("denied")
  ) {
    return "Microphone and speech recognition permission is required. Enable them in Settings."
  }

  return message || "Speech recognition failed."
}

export function isNativeSpeechRecognitionAvailable(): boolean {
  try {
    const speech = speechRecognitionRuntime.load()
    if (!speech) return false
    return Boolean(speech.isRecognitionAvailable())
  } catch {
    return false
  }
}

export type SpeechListenHandlers = {
  onPartial?: (transcript: string) => void
  onFinal?: (transcript: string) => void
  onError?: (message: string) => void
  onEnd?: () => void
}

async function pausePlaybackForMic() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { usePlayerStore } = require("@/stores/playerStore") as {
      usePlayerStore: { getState: () => { pause: () => void } }
    }
    usePlayerStore.getState().pause()
  } catch {
    /* ignore */
  }

  try {
    // Player previously locked iOS into allowsRecordingIOS:false — reopen the mic.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Audio } = require("expo-av") as {
      Audio: {
        setAudioModeAsync: (mode: Record<string, unknown>) => Promise<void>
      }
    }
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    })
  } catch {
    /* ignore */
  }
}

async function waitUntilInactive(speech: SpeechModule) {
  if (!speech.getStateAsync) return
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const state = await speech.getStateAsync()
    if (state === "inactive") return
    try {
      speech.stop()
    } catch {
      /* ignore */
    }
    await delay(120)
  }
}

export async function startNativeSpeechRecognition(
  handlers: SpeechListenHandlers,
): Promise<() => void> {
  const speech = speechRecognitionRuntime.load()
  if (!speech || !speech.isRecognitionAvailable()) {
    throw new Error("Native speech recognition is not available in this build.")
  }

  await pausePlaybackForMic()

  const micPermission = speech.requestMicrophonePermissionsAsync
    ? await speech.requestMicrophonePermissionsAsync()
    : await speech.requestPermissionsAsync()
  if (!micPermission.granted) {
    throw new Error("Microphone and speech recognition permission is required.")
  }

  // Network STT on iOS also needs Speech Recognition permission.
  const fullPermission = await speech.requestPermissionsAsync()
  if (!fullPermission.granted) {
    throw new Error("Microphone and speech recognition permission is required.")
  }

  // Never abort()+start in the same tick — that triggers kAFAssistantErrorDomain 209.
  await waitUntilInactive(speech)
  await delay(80)

  try {
    speech.setCategoryIOS?.({
      category: "playAndRecord",
      categoryOptions: ["defaultToSpeaker", "allowBluetooth", "mixWithOthers"],
      mode: "measurement",
    })
    speech.setAudioSessionActiveIOS?.(true, { notifyOthersOnDeactivation: true })
  } catch {
    /* ignore */
  }

  const onSimulator = isLikelyIosSimulator()
  const onDevice = Boolean(speech.supportsOnDeviceRecognition?.())

  const subscriptions = [
    speech.addListener("result", (event) => {
      const transcript = event.results?.[0]?.transcript?.trim()
      if (!transcript) return
      if (event.isFinal) handlers.onFinal?.(transcript)
      else handlers.onPartial?.(transcript)
    }),
    speech.addListener("error", (event) => {
      const friendly = humanizeSpeechRecognitionError(event.message || event.error, {
        onSimulator,
        code: event.error ?? event.code,
      })
      if (!friendly) return
      handlers.onError?.(friendly)
    }),
    speech.addListener("end", () => {
      handlers.onEnd?.()
    }),
  ]

  speech.start({
    lang: "en-US",
    interimResults: true,
    continuous: false,
    // On-device avoids Apple network Siri path that often fails on Simulator (209).
    requiresOnDeviceRecognition: onDevice,
    iosCategory: {
      category: "playAndRecord",
      categoryOptions: ["defaultToSpeaker", "allowBluetooth", "mixWithOthers"],
      mode: "measurement",
    },
    contextualStrings: [
      "Prabhat Samgiita",
      "song",
      "morning",
      "meditation",
      "devotion",
      "peace",
      "harmonium",
    ],
  })

  return () => {
    try {
      speech.stop()
    } catch {
      /* ignore */
    }
    for (const sub of subscriptions) sub.remove()
  }
}

export function stopNativeSpeechRecognition() {
  try {
    const speech = speechRecognitionRuntime.load()
    if (!speech) return
    try {
      speech.stop()
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}
