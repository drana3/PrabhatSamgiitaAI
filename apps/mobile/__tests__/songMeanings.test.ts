import { describe, expect, it } from "vitest"

import type { MockSong } from "@/data/mock"
import { storedMeaningForLanguage } from "@/lib/songMap"
import { meaningUnavailableMessage, resolveSongMeaning } from "@/lib/songMeanings"

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

describe("storedMeaningForLanguage", () => {
  it("returns curated meanings before AI fallback", () => {
    expect(storedMeaningForLanguage(song, "hi")).toBe("हिन्दी अर्थ")
    expect(storedMeaningForLanguage(song, "bn")).toBe("বাংলা অর্থ")
    expect(storedMeaningForLanguage(song, "ta")).toBeNull()
  })
})

describe("resolveSongMeaning", () => {
  it("returns language-specific meanings without cross-language fallback", () => {
    expect(resolveSongMeaning(song, "en", null, false)).toEqual({
      status: "ready",
      text: "English meaning",
    })
    expect(resolveSongMeaning(song, "hi", null, false)).toEqual({
      status: "ready",
      text: "हिन्दी अर्थ",
    })
    expect(resolveSongMeaning(song, "bn", null, false)).toEqual({
      status: "ready",
      text: "বাংলা অর্থ",
    })
  })

  it("does not show English text when a world-language translation is missing", () => {
    expect(resolveSongMeaning(song, "nl", null, false)).toEqual({ status: "unavailable" })
    expect(resolveSongMeaning({ ...song, hindiMeaning: null }, "hi", "", false)).toEqual({
      status: "unavailable",
    })
  })

  it("rejects API text that is just the English meaning under another language", () => {
    expect(resolveSongMeaning(song, "nl", "English meaning", false)).toEqual({
      status: "unavailable",
    })
    expect(resolveSongMeaning({ ...song, hindiMeaning: null }, "hi", "English meaning", false)).toEqual({
      status: "unavailable",
    })
    expect(resolveSongMeaning({ ...song, hindiMeaning: null }, "hi", "हिन्दी अनुवाद", false)).toEqual({
      status: "ready",
      text: "हिन्दी अनुवाद",
    })
  })

  it("reports loading while localization is in flight", () => {
    expect(resolveSongMeaning(song, "nl", null, true)).toEqual({ status: "loading" })
  })
})

describe("meaningUnavailableMessage", () => {
  it("names the selected language in the unavailable copy", () => {
    expect(meaningUnavailableMessage("nl")).toContain("Dutch")
    expect(meaningUnavailableMessage("Hindi")).toContain("Hindi")
    expect(meaningUnavailableMessage("Hindi")).not.toContain("Try English or Hindi")
  })
})
