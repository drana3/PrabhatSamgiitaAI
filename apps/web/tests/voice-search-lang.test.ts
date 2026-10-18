import { describe, expect, it } from "vitest"

import {
  normalizeVoiceTranscript,
  pickVoiceTranscript,
  resolveVoiceSearchLang,
  VOICE_SEARCH_LANG,
} from "@/lib/voice-search-lang"

describe("voice search language", () => {
  it("always uses en-IN so Romanized lyrics match the catalog", () => {
    expect(resolveVoiceSearchLang("en-US")).toBe(VOICE_SEARCH_LANG)
    expect(resolveVoiceSearchLang("hi-IN")).toBe("en-IN")
    expect(resolveVoiceSearchLang("bn-IN")).toBe("en-IN")
    expect(resolveVoiceSearchLang(null)).toBe("en-IN")
  })

  it("normalizes curly quotes and spacing", () => {
    expect(normalizeVoiceTranscript("  “jadu   nagariya” ")).toBe('"jadu nagariya"')
  })

  it("prefers Romanized alternatives over native-script guesses", () => {
    expect(pickVoiceTranscript("जादू नगरीया", ["jadu nagariya", "jadoo nagriya"])).toBe(
      "jadu nagariya",
    )
  })
})
