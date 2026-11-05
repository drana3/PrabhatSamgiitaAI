import { describe, expect, it } from "vitest"

import { learningStreak } from "@/lib/learn/streak"
import type { WordCard } from "@/lib/learn/srs"
import {
  DEFAULT_SETTINGS,
  QUIET_FROM_TIMES,
  SETTINGS_VERSION,
  SONG_TIMES,
  WORDS_TIMES,
  anyEnabled,
  formatMinutes,
  kindEnabled,
  migrateSettings,
  setKindOn,
  setKindTime,
  setQuiet,
} from "@/lib/notifications/settings"

describe("notification settings: defaults", () => {
  it("starts with song 8:00, festivals, words 18:00, live on, streak off, quiet 21:00 to 7:00, master on", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      master: true,
      song: { on: true, at: 480 },
      festival: { on: true },
      words: { on: true, at: 1080 },
      streak: { on: false },
      live: { on: true },
      quiet: { on: true, from: 1260, to: 420 },
    })
  })

  it("offers the song time from 6:00 to 10:00 in 30 minute steps", () => {
    expect(SONG_TIMES[0]).toBe(360)
    expect(SONG_TIMES[SONG_TIMES.length - 1]).toBe(600)
    expect(SONG_TIMES).toHaveLength(9)
    expect(SONG_TIMES.every((m, i) => i === 0 || m - SONG_TIMES[i - 1]! === 30)).toBe(true)
    expect(WORDS_TIMES).toContain(1080)
  })

  it("formats times on a 24-hour clock", () => {
    expect(formatMinutes(480)).toBe("8:00")
    expect(formatMinutes(1110)).toBe("18:30")
    expect(formatMinutes(0)).toBe("0:00")
  })
})

describe("notification settings: migration", () => {
  it("turns nothing, null and garbage into the defaults", () => {
    for (const bad of [undefined, null, 5, "x", [], { song: 3 }]) expect(migrateSettings(bad, 0)).toEqual(DEFAULT_SETTINGS)
  })

  it("keeps valid saved values and fills what is missing", () => {
    const saved = { master: false, song: { on: false, at: 540 }, quiet: { on: false } }
    const out = migrateSettings(saved, SETTINGS_VERSION)
    expect(out.master).toBe(false)
    expect(out.song).toEqual({ on: false, at: 540 })
    expect(out.quiet).toEqual({ on: false, from: 1260, to: 420 })
    expect(out.words).toEqual(DEFAULT_SETTINGS.words)
  })

  it("snaps a time outside the choices to the nearest one and ignores wrong types", () => {
    const out = migrateSettings({ song: { at: 100 }, words: { at: 9999, on: "yes" }, quiet: { from: 1300, to: "7" } })
    expect(out.song.at).toBe(360)
    expect(out.words.at).toBe(Math.max(...WORDS_TIMES))
    expect(out.words.on).toBe(true)
    expect(out.quiet.from).toBe(1320)
    expect(out.quiet.to).toBe(420)
  })

  it("drops unknown keys and is idempotent", () => {
    const out = migrateSettings({ ...DEFAULT_SETTINGS, extra: 1, song: { on: true, at: 510, junk: true } })
    expect(out).not.toHaveProperty("extra")
    expect(out.song).toEqual({ on: true, at: 510 })
    expect(migrateSettings(out)).toEqual(out)
  })
})

describe("notification settings: changes", () => {
  it("switches a kind and respects the master switch", () => {
    const s = setKindOn(DEFAULT_SETTINGS, "streak", true)
    expect(kindEnabled(s, "streak")).toBe(true)
    expect(kindEnabled({ ...s, master: false }, "streak")).toBe(false)
    expect(anyEnabled({ ...DEFAULT_SETTINGS, master: false })).toBe(false)
    expect(anyEnabled(setKindOn(setKindOn(setKindOn(setKindOn({ ...DEFAULT_SETTINGS, streak: { on: false } }, "song", false), "festival", false), "words", false), "live", false))).toBe(false)
  })

  it("sets a time only to a choice", () => {
    expect(setKindTime(DEFAULT_SETTINGS, "song", 570).song.at).toBe(570)
    expect(setKindTime(DEFAULT_SETTINGS, "song", 575).song.at).toBe(570)
    expect(setQuiet(DEFAULT_SETTINGS, { from: QUIET_FROM_TIMES[0] }).quiet.from).toBe(QUIET_FROM_TIMES[0])
  })
})

describe("learning streak", () => {
  const NOW = new Date(2026, 10, 5, 12, 0).getTime()
  const day = (back: number) => new Date(2026, 10, 5 - back, 10, 0).getTime()
  const withHistory = (...backs: number[]): Record<string, WordCard> => ({
    a: {
      wordId: "a",
      status: "review",
      dueAt: NOW,
      intervalDays: 1,
      ease: 2.5,
      step: 0,
      reps: backs.length,
      lapses: 0,
      lastReviewedAt: null,
      history: backs.map((b) => ({ at: day(b), grade: "good" as const })),
    },
  })

  it("counts days in a row up to today", () => {
    expect(learningStreak(withHistory(0, 1, 2, 3), NOW)).toEqual({ days: 4, reviewedToday: true })
  })
  it("keeps a streak alive until the end of today when it reached yesterday", () => {
    expect(learningStreak(withHistory(1, 2, 3), NOW)).toEqual({ days: 3, reviewedToday: false })
  })
  it("breaks on a gap and is zero without reviews", () => {
    expect(learningStreak(withHistory(0, 1, 3, 4), NOW).days).toBe(2)
    expect(learningStreak(withHistory(2, 3), NOW).days).toBe(0)
    expect(learningStreak({}, NOW)).toEqual({ days: 0, reviewedToday: false })
  })
})
