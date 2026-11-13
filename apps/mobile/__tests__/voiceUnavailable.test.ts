import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("voice search on a phone without a speech service", () => {
  const source = readFileSync(path.resolve(__dirname, "../lib/useVoiceSearch.ts"), "utf8")

  it("tells members the truth instead of asking them for a development build", () => {
    expect(source).toContain("export const VOICE_UNAVAILABLE_MESSAGE")
    expect(source).not.toMatch(/development build/i)
    expect(source).toMatch(/isNativeSpeechRecognitionAvailable\(\)/)
  })
})
