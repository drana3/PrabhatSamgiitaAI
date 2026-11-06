import { describe, expect, it } from "vitest"

import { setActiveLanguage } from "@/lib/i18n/core"
import type { WordCard } from "@/lib/learn/srs"
import {
  MAX_PENDING,
  capForPlatform,
  diffSchedule,
  firedSince,
  plan,
  scheduleAhead,
scheduleNext7Days,
  toInboxItem,
  type PlanInput,
  type SongPick,
} from "@/lib/notifications/schedule"
import { DEFAULT_SETTINGS, type NotificationSettings } from "@/lib/notifications/settings"

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

function input(patch: Partial<PlanInput> = {}, settings: Partial<NotificationSettings> = {}): PlanInput {
  return {
    now: NOW,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    songs: SONGS,
    festivals: [],
    cards: {},
    streak: { days: 0, reviewedToday: false },
    ...patch,
  }
}

const ids = (list: { id: string }[]) => list.map((n) => n.id)
const kinds = (list: { kind: string }[]) => list.map((n) => n.kind)

describe("scheduler: window and ids", () => {
  it("plans only the next 7 days after now, one song of the day per morning", () => {
    const out = scheduleNext7Days(input())
    expect(ids(out)).toEqual([6, 7, 8, 9, 10, 11, 12].map((d) => `song:2026-11-${String(d).padStart(2, "0")}@0800`))
    for (const n of out) {
      expect(n.fireAt).toBeGreaterThan(NOW)
      expect(n.fireAt).toBeLessThanOrEqual(NOW + 7 * DAY)
    }
  })

  it("gives the same ids and times when asked twice, with the time in the id", () => {
    const a = scheduleNext7Days(input())
    const b = scheduleNext7Days(input())
    expect(b).toEqual(a)
    expect(a.every((n) => /@\d{4}$/.test(n.id))).toBe(true)
    expect(new Set(ids(a)).size).toBe(a.length)
  })

  it("uses the exact minute the person chose, not a step", () => {
    const out = scheduleNext7Days(input({}, { song: { on: true, times: [9 * 60 + 37] } }))
    expect(out[0]?.fireAt).toBe(at(11, 5, 9, 37))
    expect(out[0]?.id).toBe("song:2026-11-05@0937")
    const midnight = scheduleNext7Days(input({}, { song: { on: true, times: [0] } }))
    expect(midnight[0]?.fireAt).toBe(at(11, 6, 0, 0))
    const late = scheduleNext7Days(input({}, { song: { on: true, times: [23 * 60 + 59] } }))
    expect(late[0]?.fireAt).toBe(at(11, 5, 23, 59))
  })

  it("makes nothing when the master switch or the kind is off", () => {
    expect(scheduleNext7Days(input({}, { master: false }))).toEqual([])
    expect(scheduleNext7Days(input({}, { song: { on: false, times: [480] } }))).toEqual([])
  })

  it("says what the song is: composed on this day, the song Today shows, or a plain line", () => {
    const out = scheduleNext7Days(input())
    const composed = out.find((n) => n.id === "song:2026-11-08@0800")
    expect(composed?.text).toBe("Ándhára Sheśe Álora Deshe was composed on this day in 1983.")
    expect(composed?.target).toBe("/song-v2/ps-3")
    // a day with no known song: the reminder does not name a song of its own
    const plain = out.find((n) => n.id === "song:2026-11-06@0800")
    expect(plain?.text).toBe("Open today's song.")
    expect(plain?.target).toBe("/v2/today")
    expect(plain?.coverNumber).toBeUndefined()
    const none = scheduleNext7Days(input({ songs: [] }))
    expect(none[0]?.text).toBe("Open today's song.")
    expect(none[0]?.target).toBe("/v2/today")
  })

  it("names the song of the day only for the day Today has it, and that is the one song Today shows", () => {
    const todaySong = { date: "2026-11-06", song: { number: 5, title: "Elo, Anek Juger Sei Ajáná Pathik" } }
    const out = scheduleNext7Days(input({ todaySong }))
    const named = out.find((n) => n.id === "song:2026-11-06@0800")
    expect(named?.text).toBe("Start the day with Elo, Anek Juger Sei Ajáná Pathik.")
    expect(named?.target).toBe("/song-v2/ps-5")
    expect(named?.coverNumber).toBe(5)
    // the next days are not guessed
    expect(out.find((n) => n.id === "song:2026-11-07@0800")?.text).toBe("Open today's song.")
    // the song Today shows wins over a composition date from another source
    const both = scheduleNext7Days(input({ todaySong: { date: "2026-11-08", song: { number: 5, title: "Elo" } } }))
    expect(both.find((n) => n.id === "song:2026-11-08@0800")?.target).toBe("/song-v2/ps-5")
  })
})

describe("scheduler: several times a day", () => {
  it("makes one notification per time, in the order they fire, each with its own id", () => {
    const out = plan(input({}, { song: { on: true, times: [7 * 60 + 45, 12 * 60, 21 * 60 + 5] } }), at(11, 6), at(11, 7))
    expect(ids(out)).toEqual(["song:2026-11-06@0745", "song:2026-11-06@1200", "song:2026-11-06@2105"])
    expect(out.map((n) => n.fireAt)).toEqual([at(11, 6, 7, 45), at(11, 6, 12, 0), at(11, 6, 21, 5)])
  })

  it("plans all five word times when words are due, and none while nothing is due", () => {
    const times = [7 * 60, 10 * 60 + 30, 13 * 60, 16 * 60 + 15, 20 * 60 + 40]
    const due = { a: card("a", NOW - DAY) }
    const out = plan(input({ cards: due }, { words: { on: true, times } }), at(11, 6), at(11, 7)).filter((n) => n.kind === "words")
    expect(out).toHaveLength(5)
    expect(out.map((n) => n.id.split("@")[1])).toEqual(["0700", "1030", "1300", "1615", "2040"])
    expect(plan(input({}, { words: { on: true, times } }), at(11, 6), at(11, 7)).filter((n) => n.kind === "words")).toEqual([])
  })

  it("counts words at the moment each time falls: a card due at 12:00 appears only for later times", () => {
    const cards = { a: card("a", at(11, 6, 12, 0)) }
    const out = plan(input({ cards }, { words: { on: true, times: [9 * 60, 15 * 60] } }), at(11, 6), at(11, 7)).filter((n) => n.kind === "words")
    expect(ids(out)).toEqual(["words:2026-11-06@1500"])
  })

  it("has no daily limit and no quiet hours: a crowded late-night day keeps everything", () => {
    const cards = { w: card("w", NOW - DAY) }
    const festivals = [{ id: "f", title: "F", month: 11, day: 7, year: 2026 }]
    const out = plan(
      input(
        { cards, festivals, streak: { days: 4, reviewedToday: true } },
        {
          streak: { on: true },
          song: { on: true, times: [0, 5 * 60 + 5, 23 * 60 + 30] },
          words: { on: true, times: [60, 3 * 60, 22 * 60 + 15, 23 * 60] },
        },
      ),
      at(11, 6),
      at(11, 7),
    )
    // 3 songs + 4 words + festival eve (17:00) + streak (20:00, tomorrow's evening)
    expect(kinds(out).filter((k) => k === "song")).toHaveLength(3)
    expect(kinds(out).filter((k) => k === "words")).toHaveLength(4)
    expect(kinds(out)).toContain("festival")
    expect(kinds(out)).toContain("streak")
    expect(out).toHaveLength(9)
    // a time at night stays at night
    expect(out.some((n) => n.fireAt === at(11, 6, 23, 30))).toBe(true)
    expect(out.some((n) => n.fireAt === at(11, 6, 0, 0))).toBe(false) // 0:00 of the 6th is the window start (exclusive)
  })

  it("orders two kinds that share a minute by kind, not by chance", () => {
    const cards = { w: card("w", NOW - DAY) }
    const out = plan(input({ cards }, { song: { on: true, times: [600] }, words: { on: true, times: [600] } }), at(11, 6), at(11, 7))
    expect(kinds(out)).toEqual(["words", "song"])
  })

  it("keeps the other times' ids when one time is added, moved or removed", () => {
    const base = plan(input({}, { song: { on: true, times: [480, 1080] } }), at(11, 6), at(11, 7))
    const added = plan(input({}, { song: { on: true, times: [480, 720, 1080] } }), at(11, 6), at(11, 7))
    const moved = plan(input({}, { song: { on: true, times: [480, 1110] } }), at(11, 6), at(11, 7))
    const removed = plan(input({}, { song: { on: true, times: [1080] } }), at(11, 6), at(11, 7))
    expect(diffSchedule(ids(base), added)).toMatchObject({ cancel: [] })
    expect(ids(added)).toEqual(["song:2026-11-06@0800", "song:2026-11-06@1200", "song:2026-11-06@1800"])
    expect(diffSchedule(ids(base), moved).cancel).toEqual(["song:2026-11-06@1800"])
    expect(diffSchedule(ids(base), removed).cancel).toEqual(["song:2026-11-06@0800"])
  })
})

describe("scheduler: the phone's pending limit", () => {
  it("keeps the soonest notifications when there are more than the phone can hold", () => {
    const times = [6 * 60, 12 * 60, 20 * 60]
    const out = scheduleNext7Days(input({ cards: { w: card("w", NOW - DAY) } }, { song: { on: true, times }, words: { on: true, times: [7 * 60, 9 * 60, 11 * 60, 13 * 60, 15 * 60] } }))
    expect(out.length).toBeGreaterThan(40)
    expect(capForPlatform(out, 20)).toEqual(out.slice(0, 20))
    expect(capForPlatform(out, 3)).toEqual(out.slice(0, 3))
    expect(capForPlatform(out, 0)).toEqual([])
    expect(capForPlatform([], 5)).toEqual([])
  })

  it("holds the fullest week the settings allow (3 song + 5 word times a day) within the limit", () => {
    const full = scheduleNext7Days(
      input({ cards: { w: card("w", NOW - DAY) } }, { song: { on: true, times: [360, 720, 1200] }, words: { on: true, times: [420, 540, 660, 780, 900] } }),
    )
    expect(full.length).toBeLessThanOrEqual(MAX_PENDING)
    expect(capForPlatform(full)).toEqual(full)
  })

  it("leaves a normal plan whole", () => {
    const out = scheduleNext7Days(input())
    expect(capForPlatform(out)).toEqual(out)
  })
})

describe("scheduler: festival eve", () => {
  it("fires the evening before at 17:00, with the festival's own page as the target", () => {
    const out = scheduleNext7Days(input({ festivals: [{ id: "diipavalii-2026", title: "Diipavalii", month: 11, day: 8, year: 2026 }] }))
    const eve = out.find((n) => n.kind === "festival")
    expect(eve?.id).toBe("festival:diipavalii-2026")
    expect(eve?.fireAt).toBe(at(11, 7, 17, 0))
    expect(eve?.title).toBe("Festival tomorrow")
    expect(eve?.text).toBe("Diipavalii is tomorrow. Prabhat Samgiita for this day is ready in the app.")
    expect(eve?.target).toBe("/festival/diipavalii-2026")
  })

  it("promises songs only when the festival has some, and says nothing more otherwise", () => {
    const out = scheduleNext7Days(input({ festivals: [{ id: "diipavalii-2026", title: "Diipavalii", month: 11, day: 8, year: 2026, hasSongs: false }] }))
    expect(out.find((n) => n.kind === "festival")?.text).toBe("Diipavalii is tomorrow.")
  })

  it("names the festival in the app language", () => {
    setActiveLanguage("ru")
    try {
      const out = scheduleNext7Days(input({ festivals: [{ id: "prout-day-2026", title: "PROUT Day", month: 11, day: 8, year: 2026 }] }))
      expect(out.find((n) => n.kind === "festival")?.text).toBe("День PROUT — завтра. Prabhat Samgiita к этому дню уже в приложении.")
    } finally {
      setActiveLanguage("en")
    }
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

describe("scheduler: live Kiirtans are no longer scheduled", () => {
  it("plans nothing of kind live, whatever the settings", () => {
    const out = plan(input({ cards: { w: card("w", NOW - DAY) }, streak: { days: 4, reviewedToday: false } }, { streak: { on: true } }), NOW - 3 * DAY, NOW + 10 * DAY)
    expect(kinds(out).includes("live")).toBe(false)
    expect(out.every((n) => !n.id.startsWith("live:"))).toBe(true)
  })
})

describe("scheduler: words to repeat", () => {
  it("plans words only when some are due, with the right count", () => {
    expect(kinds(scheduleNext7Days(input())).includes("words")).toBe(false)
    const cards = { a: card("a", NOW - DAY), b: card("b", NOW - 1000), n: card("n", NOW - DAY, "new") }
    const out = scheduleNext7Days(input({ cards })).filter((n) => n.kind === "words")
    expect(out[0]?.id).toBe("words:2026-11-05@1800")
    expect(out[0]?.fireAt).toBe(at(11, 5, 18, 0))
    expect(out[0]?.text).toBe("2 words are due. It takes a minute.")
    expect(out[0]?.target).toBe("/learn/words")
  })

  it("says 1 word is due, and starts on the day a card becomes due", () => {
    const cards = { a: card("a", at(11, 8, 12, 0)) }
    const out = scheduleNext7Days(input({ cards })).filter((n) => n.kind === "words")
    expect(out[0]?.id).toBe("words:2026-11-08@1800")
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

    const changed = diffSchedule(ids(first), scheduleNext7Days(input({}, { song: { on: false, times: [480] } })))
    expect(changed.cancel.sort()).toEqual(ids(first).sort())
    expect(changed.schedule).toEqual([])
  })

  it("moving a time cancels the old notifications and schedules the new ones, a day at a time", () => {
    const a = scheduleNext7Days(input({}, { song: { on: true, times: [480] } }))
    const b = scheduleNext7Days(input({}, { song: { on: true, times: [540] } }))
    const diff = diffSchedule(ids(a), b)
    expect(diff.cancel.sort()).toEqual(ids(a).sort())
    expect(ids(diff.schedule)).toEqual(ids(b))
    expect(b.every((n) => new Date(n.fireAt).getHours() === 9)).toBe(true)
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
    // 7 Nov: song 8:00, festival eve 17:00, words 18:00: all three fired, in the order they fired
    expect(kinds(fired)).toEqual(["song", "festival", "words"])
    expect(firedSince(base, now)).toEqual([])
    expect(fired.every((n) => n.fireAt <= now)).toBe(true)
  })

  it("turns a planned notification into an inbox item with the same id and the fire time", () => {
    const planned = scheduleNext7Days(input())[0]!
    const item = toInboxItem(planned)
    expect(item).toMatchObject({ id: planned.id, kind: "song", title: planned.title, text: planned.text, target: planned.target, firedAt: planned.fireAt })
  })
})

describe("scheduler: plan ahead (checkup U3)", () => {
  it("keeps the song of the day coming for weeks, so a week away does not end the reminders", () => {
    const out = scheduleAhead(input())
    expect(out.length).toBeGreaterThan(20)
    expect(out.every((n) => n.kind === "song")).toBe(true)
    expect(Math.max(...out.map((n) => n.fireAt))).toBeGreaterThan(NOW + 20 * DAY)
    expect(Math.max(...out.map((n) => n.fireAt))).toBeLessThanOrEqual(NOW + 30 * DAY)
    expect(new Set(ids(out)).size).toBe(out.length)
  })

  it("plans words and the streak only for the next 7 days, they depend on what happens in between", () => {
    const card = { status: "review", dueAt: NOW - DAY } as never
    const out = scheduleAhead(
      input({ cards: { a: card }, streak: { days: 5, reviewedToday: false } }, { streak: { on: true } }),
    )
    const late = out.filter((n) => n.fireAt > NOW + 7 * DAY)
    expect(late.length).toBeGreaterThan(0)
    expect(late.every((n) => n.kind === "song" || n.kind === "festival")).toBe(true)
    expect(out.some((n) => n.kind === "words" && n.fireAt <= NOW + 7 * DAY)).toBe(true)
  })

  it("the phone cap keeps the soonest, so near reminders are never dropped for far ones", () => {
    const capped = capForPlatform(scheduleAhead(input({}, { song: { on: true, times: [8 * 60, 12 * 60, 18 * 60] } })))
    expect(capped).toHaveLength(MAX_PENDING)
    expect(capped[0]?.fireAt).toBeLessThan(NOW + DAY)
  })
})

