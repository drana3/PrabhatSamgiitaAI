import { describe, expect, it } from "vitest"

import {
  collectStoredMeanings,
  hasStoredMeaningForLanguage,
  storedMeaningForLanguage,
} from "@/lib/song-meanings"

describe("song meaning priority helpers", () => {
  const song = {
    english_meaning: "English meaning",
    hindi_meaning: "हिन्दी अर्थ",
    metadata_json: {
      localized_meanings: {
        bn: "বাংলা অর্থ",
      },
    },
  }

  it("collects meanings from columns and localized metadata", () => {
    expect(collectStoredMeanings(song)).toEqual({
      en: "English meaning",
      hi: "हिन्दी अर्थ",
      bn: "বাংলা অর্থ",
    })
  })

  it("prefers stored meaning for a language before AI fallback", () => {
    expect(storedMeaningForLanguage(song, "bn")).toBe("বাংলা অর্থ")
    expect(hasStoredMeaningForLanguage(song, "ta")).toBe(false)
  })
})
