import { describe, expect, it } from "vitest"

import songs from "../../../data/generated/songs.json"
import {
  normalizeTransliterationText,
  titleCaseTransliteration,
} from "@/lib/transliteration-text"

describe("normalizeTransliterationText", () => {
  it("composes NFD catalog titles so accents use one glyph", () => {
    const song2 = songs.find((item) => item.number === 2)
    expect(song2?.title).toBeTruthy()
    const normalized = normalizeTransliterationText(song2!.title)
    expect(normalized).not.toMatch(/\u0301/)
    expect(normalized).toContain("Ń")
    expect(normalized.length).toBeLessThan(song2!.title.length)
  })

  it("title-cases after NFC normalization", () => {
    const raw = "e ga\u0301n amar"
    expect(titleCaseTransliteration(raw)).toBe("E Gán Amar")
  })
})
