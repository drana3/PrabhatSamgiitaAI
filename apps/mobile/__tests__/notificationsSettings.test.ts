import { describe, expect, it } from "vitest"

import { learningStreak } from "@/lib/learn/streak"
import type { WordCard } from "@/lib/learn/srs"
import {
  DEFAULT_SETTINGS,
  MAX_TIMES,
  SETTINGS_VERSION,
  addKindTime,
  anyEnabled,
  canAddTime,
  everyDayAt,
  formatMinutes,
  hasTime,
  kindEnabled,
  migrateSettings,
  normalizeTimes,
  removeKindTime,
  setKindOn,
  setKindTime,
  suggestTime,
  timeParts,
  toMinutes,
  wrapMinutes,
} from "@/lib/notifications/settings"

describe("notification settings: defaults", () => {
  it("starts with song 8:00, festivals, words 18:00, streak off, master on, and no live or quiet hours", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      master: true,
      song: { on: true, times: [480] },
      festival: { on: true },
      words: { on: true, times: [1080] },
      streak: { on: false },
    })
    expect(DEFAULT_SETTINGS).not.toHaveProperty("live")
    expect(DEFAULT_SETTINGS).not.toHaveProperty("quiet")
  })

  it("allows 3 song times and 5 word times a day", () => {
    expect(MAX_TIMES).toEqual({ song: 3, words: 5 })
  })
})

describe("time formatting", () => {
  it("formats a 24-hour clock with two digits each, never AM or PM", () => {
    expect(formatMinutes(0)).toBe("00:00")
    expect(formatMinutes(5)).toBe("00:05")
    expect(formatMinutes(60)).toBe("01:00")
    expect(formatMinutes(7 * 60 + 45)).toBe("07:45")
    expect(formatMinutes(8 * 60)).toBe("08:00")
    expect(formatMinutes(12 * 60)).toBe("12:00")
    expect(formatMinutes(13 * 60)).toBe("13:00")
    expect(formatMinutes(18 * 60 + 30)).toBe("18:30")
    expect(formatMinutes(23 * 60 + 59)).toBe("23:59")
  })

  it("formats every minute of the day as HH:mm", () => {
    for (let m = 0; m < 1440; m += 1) {
      const text = formatMinutes(m)
      expect(text).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
      expect(text).not.toMatch(/AM|PM/i)
      const [h, min] = text.split(":").map(Number)
      expect(toMinutes(h!, min!)).toBe(m)
    }
  })

  it("wraps and rounds out-of-range minutes", () => {
    expect(wrapMinutes(1440)).toBe(0)
    expect(wrapMinutes(-1)).toBe(1439)
    expect(wrapMinutes(480.4)).toBe(480)
    expect(formatMinutes(1440 + 480)).toBe("08:00")
  })

  it("says what will happen, for the picker's live line", () => {
    expect(everyDayAt(8 * 60 + 5)).toBe("Every day at 08:05")
    expect(everyDayAt(18 * 60)).toBe("Every day at 18:00")
  })

  it("splits a time into hour (0 to 23) and minute and puts it back", () => {
    expect(timeParts(0)).toEqual({ hour24: 0, minute: 0 })
    expect(timeParts(12 * 60)).toEqual({ hour24: 12, minute: 0 })
    expect(timeParts(15 * 60 + 7)).toEqual({ hour24: 15, minute: 7 })
    for (let m = 0; m < 1440; m += 1) {
      const t = timeParts(m)
      expect(toMinutes(t.hour24, t.minute)).toBe(m)
    }
  })

  it("keeps minutes inside 0 to 59 and hours inside 0 to 23", () => {
    expect(toMinutes(7, 75)).toBe(7 * 60 + 59)
    expect(toMinutes(30, -4)).toBe(23 * 60)
  })

  it("keeps saved times as minutes after midnight: older saves read the same as before", () => {
    const saved = { master: true, song: { on: true, times: [485, 1020] }, festival: { on: true }, words: { on: true, times: [1080] }, streak: { on: false } }
    const read = migrateSettings(saved, SETTINGS_VERSION)
    expect(read.song.times).toEqual([485, 1020])
    expect(read.song.times.map(formatMinutes)).toEqual(["08:05", "17:00"])
    expect(migrateSettings({ song: { at: 485 } }, 1).song.times).toEqual([485])
  })
})

describe("notification settings: times", () => {
  it("sorts, de-duplicates, rounds, wraps and cuts to the limit", () => {
    expect(normalizeTimes([1080, 480, 480, 600.4], 5)).toEqual([480, 600, 1080])
    expect(normalizeTimes([1500, -60], 5)).toEqual([60, 1380])
    expect(normalizeTimes([5, 4, 3, 2, 1], 3)).toEqual([1, 2, 3])
    expect(normalizeTimes(["8", null, NaN, Infinity, 480], 5)).toEqual([480])
    expect(normalizeTimes("x", 5)).toEqual([])
  })

  it("finds a time that is already there, ignoring the one being edited", () => {
    expect(hasTime([480, 1080], 480)).toBe(true)
    expect(hasTime([480, 1080], 480, 0)).toBe(false)
    expect(hasTime([480, 1080], 481)).toBe(false)
  })

  it("suggests a free time in the middle of the longest gap of the day, in quarter hours", () => {
    expect(suggestTime([480])).toBe(15 * 60)
    expect(suggestTime([18 * 60])).toBe(12 * 60)
    expect(suggestTime([])).toBe(14 * 60)
    expect(suggestTime([8 * 60, 15 * 60])).toBe(11 * 60 + 30)
    // never a time that is taken, never a night time for a normal list
    for (const times of [[480], [480, 900], [480, 900, 1260], [360, 1320], [0], [1439, 1]]) {
      const t = suggestTime(times)
      expect(hasTime(times, t)).toBe(false)
      expect(t % 15).toBe(0)
    }
    expect(suggestTime([480, 900, 1260])).toBeGreaterThanOrEqual(6 * 60)
  })
})

describe("notification settings: migration", () => {
  it("turns nothing, null and garbage into the defaults", () => {
    for (const bad of [undefined, null, 5, "x", [], { song: 3 }]) expect(migrateSettings(bad, 0)).toEqual(DEFAULT_SETTINGS)
  })

  it("is version 2", () => {
    expect(SETTINGS_VERSION).toBe(2)
  })

  it("reads a whole version 1 value: the single time becomes a list, live and quiet are dropped", () => {
    const old = {
      master: false,
      song: { on: false, at: 540 },
      festival: { on: true },
      words: { on: true, at: 1140 },
      streak: { on: true },
      live: { on: true },
      quiet: { on: true, from: 1260, to: 420 },
    }
    const out = migrateSettings(old, 1)
    expect(out).toEqual({
      master: false,
      song: { on: false, times: [540] },
      festival: { on: true },
      words: { on: true, times: [1140] },
      streak: { on: true },
    })
    expect(out).not.toHaveProperty("live")
    expect(out).not.toHaveProperty("quiet")
    expect(JSON.stringify(out)).not.toMatch(/quiet|live|"at"/)
  })

  it("keeps an old time as it was, even one that was never a choice", () => {
    expect(migrateSettings({ song: { at: 100 } }).song.times).toEqual([100])
    expect(migrateSettings({ words: { at: 9999 } }).words.times).toEqual([wrapMinutes(9999)])
  })

  it("keeps valid saved values and fills what is missing", () => {
    const saved = { master: false, song: { on: false, times: [540, 1200] } }
    const out = migrateSettings(saved, SETTINGS_VERSION)
    expect(out.master).toBe(false)
    expect(out.song).toEqual({ on: false, times: [540, 1200] })
    expect(out.words).toEqual(DEFAULT_SETTINGS.words)
  })

  it("sorts, de-duplicates and cuts a saved list, and falls back to the default time when it is empty", () => {
    const out = migrateSettings({ song: { times: [1200, 480, 480, 700, 800, 900] }, words: { times: [] } })
    expect(out.song.times).toEqual([480, 700, 800])
    expect(out.words.times).toEqual([1080])
    expect(migrateSettings({ song: { times: ["a", null] } }).song.times).toEqual([480])
  })

  it("prefers `times` over a leftover `at`", () => {
    expect(migrateSettings({ song: { at: 600, times: [900] } }).song.times).toEqual([900])
  })

  it("ignores wrong types", () => {
    const out = migrateSettings({ words: { on: "yes", times: "6" }, master: 1 })
    expect(out.words).toEqual(DEFAULT_SETTINGS.words)
    expect(out.master).toBe(true)
  })

  it("drops unknown keys and is idempotent", () => {
    const out = migrateSettings({ ...DEFAULT_SETTINGS, extra: 1, song: { on: true, times: [510], junk: true } })
    expect(out).not.toHaveProperty("extra")
    expect(out.song).toEqual({ on: true, times: [510] })
    expect(migrateSettings(out)).toEqual(out)
    expect(migrateSettings(migrateSettings({ song: { at: 700 }, quiet: {}, live: {} }))).toEqual(migrateSettings({ song: { at: 700 } }))
  })
})

describe("notification settings: changes", () => {
  it("switches a kind and respects the master switch", () => {
    const s = setKindOn(DEFAULT_SETTINGS, "streak", true)
    expect(kindEnabled(s, "streak")).toBe(true)
    expect(kindEnabled({ ...s, master: false }, "streak")).toBe(false)
    expect(anyEnabled({ ...DEFAULT_SETTINGS, master: false })).toBe(false)
    expect(anyEnabled(setKindOn(setKindOn(setKindOn({ ...DEFAULT_SETTINGS, streak: { on: false } }, "song", false), "festival", false), "words", false))).toBe(false)
  })

  it("sets any minute, not a choice from a list", () => {
    expect(setKindTime(DEFAULT_SETTINGS, "song", 0, 7 * 60 + 45).song.times).toEqual([465])
    expect(setKindTime(DEFAULT_SETTINGS, "song", 0, 23 * 60 + 59).song.times).toEqual([1439])
    expect(setKindTime(DEFAULT_SETTINGS, "words", 0, 0).words.times).toEqual([0])
  })

  it("keeps the list sorted after a change", () => {
    const s = { ...DEFAULT_SETTINGS, song: { on: true, times: [480, 720, 1080] } }
    expect(setKindTime(s, "song", 0, 1200).song.times).toEqual([720, 1080, 1200])
  })

  it("ignores a change to a time that is already there, or to an entry that does not exist", () => {
    const s = { ...DEFAULT_SETTINGS, song: { on: true, times: [480, 720] } }
    expect(setKindTime(s, "song", 0, 720)).toBe(s)
    expect(setKindTime(s, "song", 5, 100)).toBe(s)
    expect(setKindTime(s, "song", -1, 100)).toBe(s)
    expect(setKindTime(s, "song", 0, Number.NaN)).toBe(s)
    expect(setKindTime(s, "song", 0, 480)).toMatchObject({ song: { times: [480, 720] } })
  })

  it("adds up to 3 song times and 5 word times, and stops there", () => {
    let s = DEFAULT_SETTINGS
    s = addKindTime(s, "song", 12 * 60)
    expect(canAddTime(s, "song")).toBe(true)
    s = addKindTime(s, "song", 20 * 60)
    expect(s.song.times).toEqual([480, 720, 1200])
    expect(canAddTime(s, "song")).toBe(false)
    expect(addKindTime(s, "song", 15 * 60)).toBe(s)

    for (const m of [60, 120, 180, 240]) s = addKindTime(s, "words", m)
    expect(s.words.times).toEqual([60, 120, 180, 240, 1080])
    expect(canAddTime(s, "words")).toBe(false)
    expect(addKindTime(s, "words", 300).words.times).toHaveLength(5)
  })

  it("does not add a duplicate", () => {
    expect(addKindTime(DEFAULT_SETTINGS, "song", 480)).toBe(DEFAULT_SETTINGS)
  })

  it("removes a time but never the last one", () => {
    const s = { ...DEFAULT_SETTINGS, words: { on: true, times: [480, 720, 1080] } }
    expect(removeKindTime(s, "words", 1).words.times).toEqual([480, 1080])
    expect(removeKindTime(DEFAULT_SETTINGS, "song", 0)).toBe(DEFAULT_SETTINGS)
    expect(removeKindTime(s, "words", 9)).toBe(s)
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
