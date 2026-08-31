import type { SongSummary } from "@prabhat/core"
import { describe, expect, it } from "vitest"

import { parseSongNumber, normalizeMockSong, songSummaryToMockSong, englishMeaningFromDetail } from "@/lib/songMap"
import { todayHeadline, todayModeLabel, todaySummary } from "@/lib/today"

describe("song mappers", () => {
  it("parses ps- ids used by recommendation and search navigation", () => {
    expect(parseSongNumber("ps-2155")).toBe(2155)
    expect(parseSongNumber("3")).toBe(3)
    expect(parseSongNumber("nope")).toBeNull()
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

  it("fills missing videos and themes on partial song rows", () => {
    const base = songSummaryToMockSong({
      number: 5,
      title: "Test song",
      is_verified: true,
    })
    const safe = normalizeMockSong({
      ...base,
      videos: undefined as never,
      themes: undefined as never,
    })
    expect(safe.videos).toEqual([])
    expect(safe.themes).toEqual(["Prabhat Samgiita"])
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
})

describe("today context labels", () => {
  it("labels festival and humanitarian modes like the website", () => {
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
        context: { recommendation_mode: "daily_reflection", humanitarian_context: "disaster" },
        signals: [
          {
            title: "Flood alert",
            category: "disaster",
            summary: "Communities need care.",
            source_name: "NDMA",
            source_url: "https://example.test",
          },
        ],
        recommendations: [],
        disclaimer: "",
      }),
    ).toBe("Humanitarian context")
  })

  it("surfaces news headlines from the first signal", () => {
    const today = {
      context: { humanitarian_context: "disaster" },
      signals: [
        {
          title: "River flood situation",
          category: "disaster",
          summary: "Compassion and service.",
          source_name: "NDMA",
          source_url: "https://example.test",
        },
      ],
      recommendations: [],
      disclaimer: "",
    }
    expect(todayHeadline(today)).toBe("River flood situation")
    expect(todaySummary(today)).toBe("Compassion and service.")
  })
})
