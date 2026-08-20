import { afterEach, describe, expect, it, vi } from "vitest"

import {
  humanizeSpeechRecognitionError,
  isNativeSpeechRecognitionAvailable,
  shouldUseOnDeviceRecognition,
  speechRecognitionRuntime,
  startNativeSpeechRecognition,
  stopNativeSpeechRecognition,
} from "@/lib/speechRecognition"

describe("speech recognition wrapper", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reports unavailable when the native module is missing", () => {
    vi.spyOn(speechRecognitionRuntime, "load").mockReturnValue(null)
    expect(isNativeSpeechRecognitionAvailable()).toBe(false)
  })

  it("reports available when the native module is present", () => {
    vi.spyOn(speechRecognitionRuntime, "load").mockReturnValue({
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: async () => ({ granted: true }),
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
      addListener: vi.fn(() => ({ remove: vi.fn() })),
    })
    expect(isNativeSpeechRecognitionAvailable()).toBe(true)
  })

  it("starts recognition after permissions are granted", async () => {
    const start = vi.fn()
    const stop = vi.fn()
    vi.spyOn(speechRecognitionRuntime, "load").mockReturnValue({
      isRecognitionAvailable: () => true,
      // Without installed locales, Android path should not force on-device.
      supportsOnDeviceRecognition: () => true,
      getSupportedLocales: async () => ({ installedLocales: [] }),
      requestPermissionsAsync: async () => ({ granted: true }),
      requestMicrophonePermissionsAsync: async () => ({ granted: true }),
      getStateAsync: async () => "inactive" as const,
      start,
      stop,
      abort: vi.fn(),
      addListener: vi.fn(() => ({ remove: vi.fn() })),
    })
    const stopFn = await startNativeSpeechRecognition({})
    expect(start).toHaveBeenCalled()
    expect(start.mock.calls[0]?.[0]).toMatchObject({
      lang: "en-IN",
    })
    stopFn()
    expect(stop).toHaveBeenCalled()
    stopNativeSpeechRecognition()
  })

  it("avoids Android on-device STT when the language pack is missing", async () => {
    await expect(
      shouldUseOnDeviceRecognition(
        {
          supportsOnDeviceRecognition: () => true,
          getSupportedLocales: async () => ({ installedLocales: [] }),
        },
        "en-IN",
        { platform: "android" },
      ),
    ).resolves.toBe(false)
  })

  it("humanizes Apple speech error 209", () => {
    const message = humanizeSpeechRecognitionError(
      "The operation couldn't be completed. (kAFAssistantErrorDomain error 209.)",
      { onSimulator: true },
    )
    expect(message.toLowerCase()).not.toContain("kafassistant")
    expect(message).toMatch(/microphone|listening|audio/i)
  })

  it("humanizes Android offline language pack errors", () => {
    const message = humanizeSpeechRecognitionError(
      "Requested language is supported, but not yet downloaded.",
    )
    expect(message.toLowerCase()).toMatch(/network|wi/)
    expect(message.toLowerCase()).not.toContain("not yet downloaded")
  })

  it("ignores aborted cleanup noise", () => {
    expect(humanizeSpeechRecognitionError("aborted", { code: "aborted" })).toBe("")
  })
})
