import { afterEach, describe, expect, it, vi } from "vitest"

import {
  humanizeSpeechRecognitionError,
  isNativeSpeechRecognitionAvailable,
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
      supportsOnDeviceRecognition: () => true,
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
      lang: "en-US",
      requiresOnDeviceRecognition: true,
    })
    stopFn()
    expect(stop).toHaveBeenCalled()
    stopNativeSpeechRecognition()
  })

  it("humanizes Apple speech error 209", () => {
    const message = humanizeSpeechRecognitionError(
      "The operation couldn't be completed. (kAFAssistantErrorDomain error 209.)",
      { onSimulator: true },
    )
    expect(message.toLowerCase()).not.toContain("kafassistant")
    expect(message).toMatch(/microphone|listening|audio/i)
  })

  it("ignores aborted cleanup noise", () => {
    expect(humanizeSpeechRecognitionError("aborted", { code: "aborted" })).toBe("")
  })
})
