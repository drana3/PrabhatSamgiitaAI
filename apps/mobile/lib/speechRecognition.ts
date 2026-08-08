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
  getSupportedLocales?: (options?: {
    androidRecognitionServicePackage?: string
  }) => Promise<{ locales?: string[]; installedLocales?: string[] }>
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

function platformOS(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native") as { Platform: { OS: string } }
    return Platform.OS
  } catch {
    return "unknown"
  }
}

/**
 * Prefer on-device STT only when the pack is actually usable.
 * Android often reports on-device support even when the language model is missing,
 * which surfaces "Requested language is supported, but not yet downloaded."
 */
export async function shouldUseOnDeviceRecognition(
  speech: Pick<SpeechModule, "supportsOnDeviceRecognition" | "getSupportedLocales">,
  lang = "en-US",
  options?: { platform?: string },
): Promise<boolean> {
  if (!speech.supportsOnDeviceRecognition?.()) return false
  const os = options?.platform ?? platformOS()
  // Network STT via Google is the reliable default on Android phones.
  if (os === "android") {
    if (!speech.getSupportedLocales) return false
    try {
      const { installedLocales = [] } = await speech.getSupportedLocales({
        androidRecognitionServicePackage: "com.google.android.googlequicksearchbox",
      })
      const needle = lang.toLowerCase()
      return installedLocales.some((locale) => locale.toLowerCase() === needle)
    } catch {
      return false
    }
  }
  return true
}

function isExpoGoClient(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require("expo-constants").default as { appOwnership?: string }
    return Constants.appOwnership === "expo"
  } catch {
    return false
  }
}

/** Overridable for unit tests; production uses lazy require. */
export const speechRecognitionRuntime = {
  load(): SpeechModule | null {
    if (isExpoGoClient()) return null
    try {
      // Lazy require — static import breaks Expo Go when the native module is missing.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("expo-speech-recognition") as {
        ExpoSpeechRecognitionModule?: SpeechModule
      }
      const speech = mod?.ExpoSpeechRecognitionModule
      if (!speech || typeof speech.isRecognitionAvailable !== "function") return null
      try {
        if (!speech.isRecognitionAvailable()) return null
      } catch {
        return null
      }
      return speech
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

  if (
    lower.includes("not yet downloaded") ||
    lower.includes("language is supported, but not yet") ||
    lower.includes("offline language") ||
    code === "language-not-supported"
  ) {
    return "Voice search needs a network connection on this phone (offline speech pack isn’t installed). Tap Start listening again with data/Wi‑Fi on."
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

  // expo-av setAudioModeAsync steals the mic from Android SpeechRecognizer
  // ("Couldn't capture audio" / ERROR_AUDIO). Only reopen the iOS session.
  if (platformOS() !== "ios") {
    // Give Android audio focus a moment to settle after pause before STT starts.
    await delay(400)
    return
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
  const lang = "en-US"
  // Android: use Google network STT unless the offline pack is installed.
  // iOS: keep on-device when available (avoids flaky network Siri on Simulator).
  const onDevice = await shouldUseOnDeviceRecognition(speech, lang)

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

  const startOptions: Record<string, unknown> = {
    lang,
    interimResults: true,
    continuous: false,
    requiresOnDeviceRecognition: onDevice,
    contextualStrings: [
      "Prabhat Samgiita",
      "song",
      "morning",
      "meditation",
      "devotion",
      "peace",
      "harmonium",
    ],
  }
  if (platformOS() === "android") {
    // Pin Google only when that package actually exposes locales; otherwise the
    // system default recognizer avoids ERROR_AUDIO on OEM builds without GSA.
    try {
      if (speech.getSupportedLocales) {
        const locales = await speech.getSupportedLocales({
          androidRecognitionServicePackage: "com.google.android.googlequicksearchbox",
        })
        const available =
          (locales.locales?.length ?? 0) > 0 || (locales.installedLocales?.length ?? 0) > 0
        if (available) {
          startOptions.androidRecognitionServicePackage =
            "com.google.android.googlequicksearchbox"
        }
      }
    } catch {
      /* use Android default SpeechRecognizer */
    }
  } else {
    startOptions.iosCategory = {
      category: "playAndRecord",
      categoryOptions: ["defaultToSpeaker", "allowBluetooth", "mixWithOthers"],
      mode: "measurement",
    }
  }
  speech.start(startOptions)

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
