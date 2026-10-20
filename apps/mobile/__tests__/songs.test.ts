import type { SongSummary } from "@prabhat/core"
import { describe, expect, it } from "vitest"

import {
  parseSongNumber,
  routeString,
  songSummaryToMockSong,
  englishMeaningFromDetail,
  lyricsTextFromDetail,
  songDetailToMockSong,
} from "@/lib/songMap"
import { apiSongDetail } from "./helpers/apiSongDetail"
import { todayHeadline, todayModeLabel, todaySummary } from "@/lib/today"

describe("song mappers", () => {
  it("parses ps- ids used by recommendation and search navigation", () => {
    expect(parseSongNumber("ps-2155")).toBe(2155)
    expect(parseSongNumber("3")).toBe(3)
    expect(parseSongNumber("nope")).toBeNull()
    expect(routeString("ps-1")).toBe("ps-1")
    expect(routeString(["ps-27"])).toBe("ps-27")
    expect(routeString(undefined)).toBeUndefined()
  })

  it("maps API song summaries into player-ready song cards", () => {
    const summary: SongSummary = {
      number: 3,
      title: "ÁNDHÁRA SHEŚE",
      first_line: "ÁNDHÁRA SHEŚE",
      theme: "Service",
      is_verified: true,
    }
    const song = songSummaryToMockSong(summary)
    expect(song.id).toBe("ps-3")
    expect(song.number).toBe(3)
    expect(song.themes).toContain("Service")
  })

  it("uses the first line when the catalog title is only a song number", () => {
    const song = songSummaryToMockSong({
      number: 4062,
      title: "Song 4062",
      first_line: "DUNIÁVÁNLO, TÁKATE RAHO",
      is_verified: true,
    })
    expect(song.title).toBe("DUNIÁVÁNLO, TÁKATE RAHO")
  })

  it("uses English lyrics as the meaning source when the catalog has no English meaning column", () => {
    expect(
      englishMeaningFromDetail({
        language: "English",
        lyrics_original: "Come with me to the land of light.",
        first_line: "Come with me to the land of light.",
        english_meaning: null,
      }),
    ).toBe("Come with me to the land of light.")
    expect(
      englishMeaningFromDetail({
        language: "Bengali",
        lyrics_original: "বন্ধু হে নিয়ে চলো",
        english_meaning: null,
        theme: "Devotion",
      }),
    ).toBe("Devotion")
  })

  it("uses english_meaning as lyrics for English songs when lyric columns are empty", () => {
    const poem = "I love this tiny green island\nsurrounded by the sea."
    expect(
      lyricsTextFromDetail({
        language: "English",
        lyrics_original: null,
        transliteration: null,
        english_meaning: poem,
        first_line: "I love this tiny green island",
      }),
    ).toBe(poem)
    expect(
      englishMeaningFromDetail({
        language: "English",
        lyrics_original: null,
        english_meaning: poem,
        theme: "Nature",
        central_idea: "The Great is with me.",
      }),
    ).toBe("The Great is with me.")
  })

  it("hides Devanagari for English songs even when the API sends a phonetic script", () => {
    const song = songDetailToMockSong({
      ...apiSongDetail(68),
      language: "English",
      first_line: "I love this tiny green island",
      title: "I love this tiny green island",
      lyrics_original: null,
      english_meaning: "I love this tiny green island\nsurrounded by the sea.",
      lyrics_devanagari: "आइ लव दिस टाइनी ग्रीन आइलैण्ड",
      devanagari_status: "provisional",
    })
    expect(song.lyrics).toContain("surrounded by the sea")
    expect(song.lyricsDevanagari).toBeNull()
    expect(song.devanagariStatus).toBe("none")
  })
})

describe("today context labels", () => {
  it("labels festival days and song of the day", () => {
    expect(
      todayModeLabel({
        context: { recommendation_mode: "strict_festival", festival: "Ánanda Purnimá" },
        signals: [],
        recommendations: [],
        disclaimer: "",
      }),
    ).toBe("Festival day")

    expect(
      todayModeLabel({
        context: { recommendation_mode: "song_of_the_day" },
        signals: [],
        recommendations: [],
        disclaimer: "",
      }),
    ).toBe("Today")
  })

  it("shows the song title instead of a news headline", () => {
    const today = {
      context: { recommendation_mode: "song_of_the_day", date: "2026-10-07", song_of_the_day: 1 },
      signals: [
        {
          title: "River flood situation",
          category: "disaster",
          summary: "Compassion and service.",
          source_name: "NDMA",
          source_url: "https://example.test",
        },
        {
          title: "Song of the Day",
          category: "song_of_the_day",
          summary: "PS 1 · 07 October 2026",
          source_name: "Prabhat Samgiita",
          source_url: "https://example.test/songs/1",
        },
      ],
      recommendations: [{ number: 12, title: "Bandhu", first_line: "Line", reasons: [], score: 1, is_verified: true }],
      disclaimer: "",
    }
    expect(todayHeadline(today)).toBe("Song of the Day")
    expect(todaySummary(today)).toContain("PS 1")
    expect(todaySummary(today)).toContain("Line")
  })
})
