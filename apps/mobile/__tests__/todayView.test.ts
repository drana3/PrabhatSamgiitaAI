import { describe, expect, it } from "vitest"

import type { MockSong } from "@/data/mock"
import type { StorySummary } from "@/data/stories"
import {
  buildTodayView,
  formatTodayEyebrow,
  resumeProgress,
  storyOfTheWeek,
  TODAY_FIND_ROWS,
} from "@/lib/todayView"

function song(number: number, title = `Song ${number}`): MockSong {
  return {
    id: `ps-${number}`,
    number,
    title,
    shortDescription: "",
    imageUrl: "",
    thumbnailUrl: "",
    themes: [],
    meaning: "",
    lyrics: "",
    translation: "",
    durationSeconds: 300,
    performer: "",
    videos: [],
  }
}

function recent(number: number) {
  return { id: `ps-${number}`, number, title: `Song ${number}`, thumbnailUrl: "", themes: [] }
}

describe("formatTodayEyebrow", () => {
  it("prints the label and a short upper-case date", () => {
    expect(formatTodayEyebrow(new Date(2026, 10, 3))).toBe("TODAY'S SONG / 3 NOV")
  })
})

describe("buildTodayView", () => {
  it("uses the first recommendation as the song of the day", () => {
    const view = buildTodayView({
      recommended: [song(1), song(2)],
      recentPlays: [],
      now: new Date(2026, 10, 3),
    })
    expect(view.hero?.number).toBe(1)
  })

  it("resumes the last played song when there is history", () => {
    const view = buildTodayView({
      recommended: [song(1)],
      recentPlays: [recent(7), recent(8), recent(9), recent(10)],
      now: new Date(2026, 10, 3),
    })
    expect(view.resume).toEqual({ kind: "resume", song: expect.objectContaining({ number: 7 }) })
  })

  it("shows the song of the day in the resume block and skips the recent block without history", () => {
    const view = buildTodayView({ recommended: [song(1)], recentPlays: [], now: new Date() })
    expect(view.resume).toEqual({ kind: "songOfDay", song: expect.objectContaining({ number: 1 }) })
    expect(view.recent).toEqual([])
  })

  it("lists three recent songs after the one being resumed", () => {
    const view = buildTodayView({
      recommended: [song(1)],
      recentPlays: [recent(7), recent(8), recent(9), recent(10), recent(11)],
      now: new Date(),
    })
    expect(view.recent.map((s) => s.number)).toEqual([8, 9, 10])
  })

  it("has no hero or resume block when nothing is loaded", () => {
    const view = buildTodayView({ recommended: [], recentPlays: [], now: new Date() })
    expect(view.hero).toBeNull()
    expect(view.resume).toBeNull()
  })

  it("falls back to the last played song as hero when recommendations are empty", () => {
    const view = buildTodayView({ recommended: [], recentPlays: [recent(7)], now: new Date() })
    expect(view.hero?.number).toBe(7)
  })
})

describe("resumeProgress", () => {
  it("is the played share of the current song, clamped to 0..1", () => {
    expect(resumeProgress(30, 120)).toBe(0.25)
    expect(resumeProgress(500, 120)).toBe(1)
    expect(resumeProgress(-5, 120)).toBe(0)
    expect(resumeProgress(10, 0)).toBe(0)
  })
})

describe("TODAY_FIND_ROWS", () => {
  it("has Number, Words and Feeling rows that open search", () => {
    expect(TODAY_FIND_ROWS.map((r) => r.id)).toEqual(["number", "words", "feeling"])
    for (const row of TODAY_FIND_ROWS) expect(row.href).toMatch(/^\/search-v2\?focus=1&hint=/)
  })
})

describe("storyOfTheWeek", () => {
  const stories = ["a", "b", "c"].map(
    (slug): StorySummary => ({ slug, title: slug, author: "", url: "", teaser: "", themes: [], songNumbers: [] }),
  )

  it("is empty without stories", () => {
    expect(storyOfTheWeek([], new Date(2026, 10, 3))).toBeNull()
  })

  it("stays the same through one Monday-to-Sunday week", () => {
    const monday = storyOfTheWeek(stories, new Date(2026, 10, 2))
    const sunday = storyOfTheWeek(stories, new Date(2026, 10, 8))
    expect(sunday).toBe(monday)
  })

  it("moves to the next story the following Monday", () => {
    const thisWeek = storyOfTheWeek(stories, new Date(2026, 10, 2))!
    const nextWeek = storyOfTheWeek(stories, new Date(2026, 10, 9))!
    expect(stories.indexOf(nextWeek)).toBe((stories.indexOf(thisWeek) + 1) % stories.length)
  })
})
