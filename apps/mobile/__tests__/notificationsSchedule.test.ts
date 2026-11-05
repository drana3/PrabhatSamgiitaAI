import { describe, expect, it } from "vitest"

import type { LiveItem } from "@/lib/kirtan/live"
import type { WordCard } from "@/lib/learn/srs"
import {
  diffSchedule,
  firedSince,
  plan,
  scheduleNext7Days,
  shiftOutOfQuiet,
  toInboxItem,
  type PlanInput,
  type SongPick,
} from "@/lib/notifications/schedule"
import { DEFAULT_SETTINGS, MAX_PER_DAY, type NotificationSettings } from "@/lib/notifications/settings"

const at = (m: number, d: number, h = 0, min = 0) => new Date(2026, m - 1, d, h, min).getTime()
/** Thursday 5 November 2026, 09:00 local: today's 8:00 song has already passed */
const NOW = at(11, 5, 9)
const DAY = 86_400_000

const SONGS: SongPick[] = [
  { number: 3, title: "Ándhára Sheśe Álora Deshe", composed: { month: 11, day: 8, year: 1983 } },
  { number: 1, title: "Bandhu He Niye Calo" },
  { number: 5, title: "Elo, Anek Juger Sei Ajáná Pathik" },
]

const card = (id: string, dueAt: number, status: WordCard["status"] = "review"): WordCard => ({
  wordId: id,
  status,
  dueAt,
  intervalDays: 1,
  ease: 2.5,
  step: 0,
  reps: 1,
  lapses: 0,
  lastReviewedAt: null,
  history: [],
})

const live = (id: string, startsAt: number, durationMin = 60): LiveItem => ({
  id,
  title: "Evening dharmacakra kiirtan",
  host: "Delhi group",
  platform: "youtube",
  startsAt,
  durationMin,
  status: "upcoming",
})

function input(patch: Partial<PlanInput> = {}, settings: Partial<NotificationSettings> = {}): PlanInput {
  return {
    now: NOW,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    songs: SONGS,
    festivals: [],
    cards: {},
    streak: { days: 0, reviewedToday: false },
    live: [],
    remindIds: [],
    ...patch,
  }
}

const ids = (list: { id: string }[]) => list.map((n) => n.id)
const kinds = (list: { kind: string }[]) => list.map((n) => n.kind)

describe("scheduler: window and ids", () => {
  it("plans only the next 7 days after now, one song of the day per morning", () => {
    const out = scheduleNext7Days(input())
    expect(ids(out)).toEqual([6, 7, 8, 9, 10, 11, 12].map((d) => `song:2026-11-${String(d).padStart(2, "0")}`))
    for (const n of out) {
      expect(n.fireAt).toBeGreaterThan(NOW)
      expect(n.fireAt).toBeLessThanOrEqual(NOW + 7 * DAY)
    }
  })

  it("gives the same ids and times when asked twice, and ids never contain the time", () => {
    const a = scheduleNext7Days(input())
    const b = scheduleNext7Days(input())
    expect(b).toEqual(a)
    expect(a.every((n) => !/\d{1,2}:\d{2}$/.test(n.id))).toBe(true)
    expect(new Set(ids(a)).size).toBe(a.length)
  })

  it("uses the time the person chose", () => {
    const out = scheduleNext7Days(input({}, { song: { on: true, at: 9 * 60 + 30 } }))
    expect(out[0]?.fireAt).toBe(at(11, 5, 9, 30))
    expect(out[0]?.id).toBe("song:2026-11-05")
  })

  it("makes nothing when the master switch or the kind is off", () => {
    expect(scheduleNext7Days(input({}, { master: false }))).toEqual([])
    expect(scheduleNext7Days(input({}, { song: { on: false, at: 480 } }))).toEqual([])
  })

  it("says what the song is: composed on this day, or the daily pick, or a plain line without songs", () => {
    const out = scheduleNext7Days(input())
    const composed = out.find((n) => n.id === "song:2026-11-08")
    expect(composed?.text).toBe("Ándhára Sheśe Álora Deshe was composed on this day in 1983.")
    expect(composed?.target).toBe("/song-v2/ps-3")
    const pick = out.find((n) => n.id === "song:2026-11-06")
    expect(pick?.text).toMatch(/^Start the day with /)
    expect(pick?.coverNumber).toBeGreaterThan(0)
    const none = scheduleNext7Days(input({ songs: [] }))
    expect(none[0]?.text).toBe("Open today's song.")
    expect(none[0]?.target).toBe("/v2/today")
  })
})

describe("scheduler: quiet hours", () => {
  it("moves a time inside quiet hours to their end, keeping the id", () => {
    const out = scheduleNext7Days(input({}, { song: { on: true, at: 6 * 60 } }))
    expect(out[0]?.id).toBe("song:2026-11-06")
    expect(out[0]?.fireAt).toBe(at(11, 6, 7, 0))
  })

  it("moves an evening time to the next morning", () => {
    expect(shiftOutOfQuiet(at(11, 5, 22, 30), DEFAULT_SETTINGS.quiet)).toBe(at(11, 6, 7, 0))
    expect(shiftOutOfQuiet(at(11, 5, 3, 0), DEFAULT_SETTINGS.quiet)).toBe(at(11, 5, 7, 0))
    expect(shiftOutOfQuiet(at(11, 5, 21, 0), DEFAULT_SETTINGS.quiet)).toBe(at(11, 6, 7, 0))
    expect(shiftOutOfQuiet(at(11, 5, 7, 0), DEFAULT_SETTINGS.quiet)).toBe(at(11, 5, 7, 0))
    expect(shiftOutOfQuiet(at(11, 5, 20, 59), DEFAULT_SETTINGS.quiet)).toBe(at(11, 5, 20, 59))
  })

  it("handles quiet hours that do not cross midnight, and quiet hours that are off", () => {
    const day = { on: true, from: 12 * 60, to: 14 * 60 }
    expect(shiftOutOfQuiet(at(11, 5, 13, 0), day)).toBe(at(11, 5, 14, 0))
    expect(shiftOutOfQuiet(at(11, 5, 14, 0), day)).toBe(at(11, 5, 14, 0))
    expect(shiftOutOfQuiet(at(11, 5, 22, 0), { ...DEFAULT_SETTINGS.quiet, on: false })).toBe(at(11, 5, 22, 0))
  })

  it("never plans anything inside quiet hours", () => {
    const cards = { w: card("w", NOW - DAY) }
    const out = scheduleNext7Days(
      input({ cards }, { song: { on: true, at: 6 * 60 }, words: { on: true, at: 20 * 60 }, quiet: { on: true, from: 20 * 60, to: 9 * 60 } }),
    )
    expect(out.length).toBeGreaterThan(0)
    for (const n of out) {
      const d = new Date(n.fireAt)
      const m = d.getHours() * 60 + d.getMinutes()
      expect(m >= 9 * 60 && m < 20 * 60).toBe(true)
    }
  })

  it("does not shift a live reminder: the person asked for that moment", () => {
    const item = live("l1", at(11, 6, 6, 0))
    const out = scheduleNext7Days(input({ live: [item], remindIds: ["l1"] }))
    expect(out.find((n) => n.id === "live:l1")?.fireAt).toBe(at(11, 6, 5, 45))
  })
})

describe("scheduler: at most 2 a day, by priority", () => {
  const festival = [{ id: "fest", title: "Díipávalii", month: 11, day: 7, year: 2026 }]
  const cards = { w1: card("w1", NOW - DAY), w2: card("w2", NOW - 2 * DAY) }

  it("keeps festival and words and drops the song on a crowded day", () => {
    const out = scheduleNext7Days(input({ festivals: festival, cards })).filter((n) => n.fireAt >= at(11, 6) && n.fireAt < at(11, 7))
    expect(kinds(out)).toEqual(["festival", "words"])
  })

  it("puts a live reminder first", () => {
    const item = live("l1", at(11, 6, 12, 0))
    const out = scheduleNext7Days(input({ festivals: festival, cards, live: [item], remindIds: ["l1"] })).filter(
      (n) => n.fireAt >= at(11, 6) && n.fireAt < at(11, 7),
    )
    expect(kinds(out).sort()).toEqual(["festival", "live"])
  })

  it("ranks live > festival > words > song > streak when the whole day is still ahead", () => {
    const streak = { days: 4, reviewedToday: false }
    const item = live("l1", at(11, 5, 14, 0))
    const early = at(11, 5, 6, 0)
    const out = scheduleNext7Days(
      input(
        { now: early, festivals: [{ id: "f", title: "F", month: 11, day: 6, year: 2026 }], cards, streak, live: [item], remindIds: ["l1"] },
        { streak: { on: true }, quiet: { on: false, from: 1260, to: 420 } },
      ),
    ).filter((n) => n.fireAt >= at(11, 5) && n.fireAt < at(11, 6))
    // candidates today: song 8:00, live 13:45, festival 17:00, words 18:00, streak 20:00
    expect(kinds(out)).toEqual(["live", "festival"])
  })

  it("never plans more than 2 on any day, whatever is on", () => {
    const festivals = [3, 4, 5, 6, 7, 8, 9, 10].map((d) => ({ id: `f${d}`, title: `F${d}`, month: 11, day: d, year: 2026 }))
    const lives = [1, 2, 3].map((i) => live(`l${i}`, at(11, 7, 8 + i, 0)))
    const out = scheduleNext7Days(
      input({ festivals, cards, live: lives, remindIds: ["l1", "l2", "l3"], streak: { days: 3, reviewedToday: true } }, { streak: { on: true } }),
    )
    const perDay = new Map<string, number>()
    for (const n of out) {
      const key = new Date(n.fireAt).toDateString()
      perDay.set(key, (perDay.get(key) ?? 0) + 1)
    }
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(MAX_PER_DAY)
  })

  it("counts what already fired today against today's limit", () => {
    // 09:00 now: song fired at 8:00. A live reminder at 10:00 and a festival eve at 17:00 compete for the
    // one place that is left: live wins, festival is dropped for today.
    const item = live("l1", at(11, 5, 10, 15))
    const out = scheduleNext7Days(input({ festivals: [{ id: "f", title: "F", month: 11, day: 6, year: 2026 }], live: [item], remindIds: ["l1"] }))
    const today = out.filter((n) => n.fireAt < at(11, 6))
    expect(kinds(today)).toEqual(["live"])
  })
})

describe("scheduler: festival eve", () => {
  it("fires the evening before at 17:00, with the festival's own page as the target", () => {
    const out = scheduleNext7Days(input({ festivals: [{ id: "diipavalii-2026", title: "Diipavalii", month: 11, day: 8, year: 2026 }] }))
    const eve = out.find((n) => n.kind === "festival")
    expect(eve?.id).toBe("festival:diipavalii-2026")
    expect(eve?.fireAt).toBe(at(11, 7, 17, 0))
    expect(eve?.title).toBe("Festival tomorrow")
    expect(eve?.text).toBe("Diipavalii is tomorrow. Its songs are ready.")
    expect(eve?.target).toBe("/festival/diipavalii-2026")
  })

  it("skips a festival today or in the past, and one more than a week away", () => {
    const festivals = [
      { id: "today", title: "T", month: 11, day: 5, year: 2026 },
      { id: "past", title: "P", month: 10, day: 20, year: 2026 },
      { id: "far", title: "Far", month: 12, day: 25, year: 2026 },
    ]
    expect(kinds(scheduleNext7Days(input({ festivals }))).includes("festival")).toBe(false)
  })

  it("is off with the Festivals switch", () => {
    const festivals = [{ id: "f", title: "F", month: 11, day: 8, year: 2026 }]
    expect(kinds(scheduleNext7Days(input({ festivals }, { festival: { on: false } }))).includes("festival")).toBe(false)
  })
})

describe("scheduler: live Kiirtans", () => {
  it("fires 15 minutes before the start, for broadcasts with a reminder only", () => {
    const a = live("a", at(11, 6, 18, 30))
    const b = live("b", at(11, 7, 18, 30))
    const out = scheduleNext7Days(input({ live: [a, b], remindIds: ["a"] }))
    const l = out.filter((n) => n.kind === "live")
    expect(ids(l)).toEqual(["live:a"])
    expect(l[0]?.fireAt).toBe(at(11, 6, 18, 15))
    expect(l[0]?.title).toBe("Live Kiirtan")
    expect(l[0]?.text).toBe("Starts in 15 minutes. Evening dharmacakra kiirtan.")
    expect(l[0]?.target).toBe("/kiirtan-live?id=a")
  })

  it("skips a reminder whose time has passed for the future plan, an ended broadcast, and an unknown id", () => {
    const soon = live("soon", NOW + 10 * 60_000)
    const ended = live("ended", NOW - 5 * 3_600_000, 60)
    const out = scheduleNext7Days(input({ live: [soon, ended], remindIds: ["soon", "ended", "ghost"] }))
    expect(kinds(out).includes("live")).toBe(false)
  })

  it("is off with the Live Kiirtans switch", () => {
    const a = live("a", at(11, 6, 18, 30))
    expect(kinds(scheduleNext7Days(input({ live: [a], remindIds: ["a"] }, { live: { on: false } }))).includes("live")).toBe(false)
  })

  it("drops the notification when the reminder is removed (the old id is cancelled)", () => {
    const a = live("a", at(11, 6, 18, 30))
    const before = scheduleNext7Days(input({ live: [a], remindIds: ["a"] }))
    const after = scheduleNext7Days(input({ live: [a], remindIds: [] }))
    const diff = diffSchedule(ids(before), after)
    expect(diff.cancel).toEqual(["live:a"])
  })
})

describe("scheduler: words to repeat", () => {
  it("plans words only when some are due, with the right count", () => {
    expect(kinds(scheduleNext7Days(input())).includes("words")).toBe(false)
    const cards = { a: card("a", NOW - DAY), b: card("b", NOW - 1000), n: card("n", NOW - DAY, "new") }
    const out = scheduleNext7Days(input({ cards })).filter((n) => n.kind === "words")
    expect(out[0]?.id).toBe("words:2026-11-05")
    expect(out[0]?.fireAt).toBe(at(11, 5, 18, 0))
    expect(out[0]?.text).toBe("2 words are due. It takes a minute.")
    expect(out[0]?.target).toBe("/learn/words")
  })

  it("says 1 word is due, and starts on the day a card becomes due", () => {
    const cards = { a: card("a", at(11, 8, 12, 0)) }
    const out = scheduleNext7Days(input({ cards })).filter((n) => n.kind === "words")
    expect(out[0]?.id).toBe("words:2026-11-08")
    expect(out[0]?.text).toBe("1 word is due. It takes a minute.")
  })

  it("plans nothing once the cards were reviewed (due later than the window)", () => {
    const cards = { a: card("a", NOW + 30 * DAY) }
    expect(kinds(scheduleNext7Days(input({ cards }))).includes("words")).toBe(false)
  })
})

describe("scheduler: learning streak", () => {
  const on = { streak: { on: true } }
  it("reminds this evening when no word was reviewed yet today", () => {
    const out = scheduleNext7Days(input({ streak: { days: 5, reviewedToday: false } }, on)).filter((n) => n.kind === "streak")
    expect(ids(out)).toEqual(["streak:2026-11-05"])
    expect(out[0]?.text).toBe("5 days in a row. Keep it going.")
    expect(out[0]?.fireAt).toBe(at(11, 5, 20, 0))
  })

  it("waits for tomorrow evening once today is safe, and ignores a streak of 1", () => {
    const safe = scheduleNext7Days(input({ streak: { days: 5, reviewedToday: true } }, on)).filter((n) => n.kind === "streak")
    expect(ids(safe)).toEqual(["streak:2026-11-06"])
    expect(scheduleNext7Days(input({ streak: { days: 1, reviewedToday: false } }, on)).some((n) => n.kind === "streak")).toBe(false)
  })

  it("is off by default", () => {
    expect(scheduleNext7Days(input({ streak: { days: 5, reviewedToday: false } })).some((n) => n.kind === "streak")).toBe(false)
  })
})

describe("scheduler: rescheduling does not duplicate", () => {
  it("replaces by id: the same plan twice schedules the same ids, a changed plan cancels the dropped ones", () => {
    const first = scheduleNext7Days(input())
    const again = diffSchedule(ids(first), scheduleNext7Days(input()))
    expect(again.cancel).toEqual([])
    expect(new Set(ids(again.schedule)).size).toBe(again.schedule.length)

    const changed = diffSchedule(ids(first), scheduleNext7Days(input({}, { song: { on: false, at: 480 } })))
    expect(changed.cancel.sort()).toEqual(ids(first).sort())
    expect(changed.schedule).toEqual([])
  })

  it("keeps ids stable when only the time changes", () => {
    const a = scheduleNext7Days(input({}, { song: { on: true, at: 480 } }))
    const b = scheduleNext7Days(input({}, { song: { on: true, at: 540 } }))
    expect(ids(b).slice(1)).toEqual(ids(a).slice(1))
    expect(diffSchedule(ids(a), b).cancel).toEqual([])
  })

  it("never lists one id twice in a plan, even over a long window", () => {
    const out = plan(input({ festivals: [{ id: "f", title: "F", month: 11, day: 8, year: 2026 }] }), NOW - 20 * DAY, NOW + 20 * DAY)
    expect(new Set(ids(out)).size).toBe(out.length)
  })
})

describe("scheduler: what has fired", () => {
  it("lists the past items of the window and is empty for a window with nothing", () => {
    const now = at(11, 7, 18, 30)
    const base = input({
      now,
      festivals: [{ id: "f", title: "Díipávalii", month: 11, day: 8, year: 2026 }],
      cards: { a: card("a", at(11, 6)), b: card("b", at(11, 6)) },
    })
    const fired = firedSince(base, at(11, 7))
    // 7 Nov: song 8:00, festival eve 17:00, words 18:00 -> the limit keeps festival and words
    expect(kinds(fired)).toEqual(["festival", "words"])
    expect(firedSince(base, now)).toEqual([])
    expect(fired.every((n) => n.fireAt <= now)).toBe(true)
  })

  it("turns a planned notification into an inbox item with the same id and the fire time", () => {
    const planned = scheduleNext7Days(input())[0]!
    const item = toInboxItem(planned)
    expect(item).toMatchObject({ id: planned.id, kind: "song", title: planned.title, text: planned.text, target: planned.target, firedAt: planned.fireAt })
  })
})
