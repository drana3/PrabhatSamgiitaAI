import type { SongSummary } from "@prabhat/core"
import { describe, expect, it } from "vitest"

import { parseSongNumber, songSummaryToMockSong } from "@/lib/songMap"
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
