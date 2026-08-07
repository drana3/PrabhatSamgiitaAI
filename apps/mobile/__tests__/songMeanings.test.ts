import { describe, expect, it } from "vitest"

import { storedMeaningForLanguage } from "@/lib/songMap"
import type { MockSong } from "@/data/mock"

describe("storedMeaningForLanguage", () => {
  const song: MockSong = {
    id: "ps-1",
    number: 1,
    title: "Song",
    shortDescription: "Desc",
    imageUrl: "https://example.com/a.jpg",
    thumbnailUrl: "https://example.com/a.jpg",
    themes: ["devotion"],
    meaning: "English meaning",
    hindiMeaning: "हिन्दी अर्थ",
    localizedMeanings: { bn: "বাংলা অর্থ" },
    lyrics: "Lyrics",
    translation: "Translation",
    durationSeconds: 300,
    performer: "Collection",
    videos: [],
  }

  it("returns curated meanings before AI fallback", () => {
    expect(storedMeaningForLanguage(song, "hi")).toBe("हिन्दी अर्थ")
    expect(storedMeaningForLanguage(song, "bn")).toBe("বাংলা অর্থ")
    expect(storedMeaningForLanguage(song, "ta")).toBeNull()
  })
})
