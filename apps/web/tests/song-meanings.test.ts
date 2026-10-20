import { describe, expect, it } from "vitest"

import {
  collectStoredMeanings,
  englishMeaningText,
  hasStoredMeaningForLanguage,
  normalizeProseBlock,
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

  it("unwraps soft wraps and collapses line-as-paragraph artifacts", () => {
    expect(
      normalizeProseBlock("Darkness ends,\ncrossing the threshold.\n\nCall all."),
    ).toBe("Darkness ends, crossing the threshold.\n\nCall all.")
    expect(
      normalizeProseBlock(
        ["Calling all,", "I will sing", "of this dawn", "in divine light.", "Stars above."].join(
          "\n\n",
        ),
      ),
    ).toBe("Calling all, I will sing of this dawn in divine light. Stars above.")
  })

  it("uses English lyrics as the English meaning when the song itself is English", () => {
    const englishSong = {
      language: "English",
      lyrics_original: "Come with me to the land of light.",
      english_meaning: null,
      hindi_meaning: null,
      metadata_json: {},
    }
    expect(englishMeaningText(englishSong)).toBe("Come with me to the land of light.")
    expect(storedMeaningForLanguage(englishSong, "en")).toBe("Come with me to the land of light.")
    expect(hasStoredMeaningForLanguage(englishSong, "hi")).toBe(false)
  })
})