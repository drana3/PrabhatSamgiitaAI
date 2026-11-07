import { describe, expect, it } from "vitest"

import { setActiveLanguage } from "@/lib/i18n/core"
import {
  EMPTY_INBOX,
  clearAll,
  keptByClearAll,
  pruneInbox,
  receiveFired,
  removeItem,
  restoreItem,
  sectionsOf,
  unreadCount,
  type AppNotification,
} from "@/lib/notifications"
import { channelGroupName, channelName, privatePreviewText } from "@/lib/notifications/channelNames"
import { channelFor, nativeContent } from "@/lib/notifications/content"
import { GROUP_MIN, rowsOf } from "@/lib/notifications/grouping"
import { CHANNELS, KIND_META, categoryOf, channelOf, kindMeta, type NotificationKind } from "@/lib/notifications/kinds"
import {
  BADGE_MAX,
  DELETED_KEEP_DAYS,
  MAX_IMPORTANT_ITEMS,
  MAX_LOCAL_PER_DAY,
  MAX_ORDINARY_ITEMS,
  STALE_UNREAD_DAYS,
  badgeCount,
  isExpired,
  isUnread,
} from "@/lib/notifications/retention"
import { PRIORITY, plan, type PlanInput } from "@/lib/notifications/schedule"
import { DEFAULT_SETTINGS, MAX_TIMES } from "@/lib/notifications/settings"
import { registerTargetCheck, resolveTarget } from "@/lib/notifications/target"

const DAY = 86_400_000
const at = (m: number, d: number, h = 8, min = 0) => new Date(2026, m - 1, d, h, min).getTime()
const NOW = at(11, 20, 12)
const item = (id: string, kind: NotificationKind, firedAt: number): AppNotification => ({ id, kind, title: id, text: "", target: "/v2/today", firedAt })
const daysAgo = (n: number, h = 8) => new Date(new Date(NOW).getFullYear(), new Date(NOW).getMonth(), new Date(NOW).getDate() - n, h).getTime()

describe("retention: how long each kind stays", () => {
  it("keeps a reminder for 14 days and then drops it", () => {
    expect(isExpired(item("a", "song", daysAgo(13)), [], NOW)).toBe(false)
    expect(isExpired(item("b", "song", daysAgo(14)), [], NOW)).toBe(true)
  })

  it("keeps a live notice for 2 days only", () => {
    expect(isExpired(item("a", "live", daysAgo(1)), [], NOW)).toBe(false)
    expect(isExpired(item("b", "live", daysAgo(2)), [], NOW)).toBe(true)
  })

  it("keeps a notice about an upload 90 days once read and 180 days while unread", () => {
    const u = item("upload:x:removed", "upload", daysAgo(100))
    expect(isExpired(u, [], NOW)).toBe(false)
    expect(isExpired(u, [u.id], NOW)).toBe(true)
    expect(isExpired(item("u2", "upload", daysAgo(179)), [], NOW)).toBe(false)
    expect(isExpired(item("u3", "upload", daysAgo(180)), [], NOW)).toBe(true)
  })

  it("prunes by kind and by the 100-item cap, newest kept", () => {
    const many = Array.from({ length: MAX_ORDINARY_ITEMS + 25 }, (_, i) => item(`s${i}`, "words", NOW - i * 60_000))
    const out = pruneInbox({ ...EMPTY_INBOX, items: many }, NOW)
    expect(out.items).toHaveLength(MAX_ORDINARY_ITEMS)
    expect(out.items[0]?.id).toBe("s0")
    expect(out.items.some((n) => n.id === `s${MAX_ORDINARY_ITEMS}`)).toBe(false)
  })

  it("has a separate cap for important items, so reminders never push a removal notice out", () => {
    const notices = Array.from({ length: MAX_IMPORTANT_ITEMS + 5 }, (_, i) => item(`n${i}`, "upload", NOW - i * 60_000))
    const reminders = Array.from({ length: MAX_ORDINARY_ITEMS + 10 }, (_, i) => item(`r${i}`, "song", NOW - 10 * DAY / 100 - i * 1000))
    const out = pruneInbox({ ...EMPTY_INBOX, items: [...notices, ...reminders] }, NOW)
    expect(out.items.filter((n) => n.kind === "upload")).toHaveLength(MAX_IMPORTANT_ITEMS)
    expect(out.items.filter((n) => n.kind === "song")).toHaveLength(MAX_ORDINARY_ITEMS)
  })

  it("forgets deleted ids after 90 days but not before", () => {
    const state = { ...EMPTY_INBOX, deleted: { fresh: daysAgo(DELETED_KEEP_DAYS - 1), old: daysAgo(DELETED_KEEP_DAYS) } }
    expect(Object.keys(pruneInbox(state, NOW).deleted)).toEqual(["fresh"])
  })

  it("does not take in an item that is already past its keep time", () => {
    const out = receiveFired(EMPTY_INBOX, [item("old", "song", daysAgo(15)), item("ok", "song", daysAgo(3))], NOW)
    expect(out.items.map((n) => n.id)).toEqual(["ok"])
  })
})

describe("unread, stale and the badge", () => {
  it("a reminder stops counting as unread after a week; a notice about an upload never does", () => {
    expect(isUnread(item("a", "words", daysAgo(STALE_UNREAD_DAYS - 1)), [], NOW)).toBe(true)
    expect(isUnread(item("b", "words", daysAgo(STALE_UNREAD_DAYS)), [], NOW)).toBe(false)
    expect(isUnread(item("c", "upload", daysAgo(120)), [], NOW)).toBe(true)
    expect(isUnread(item("d", "upload", daysAgo(1)), ["d"], NOW)).toBe(false)
  })

  it("counts unread the same for the dot and the badge", () => {
    const list = [item("a", "song", daysAgo(0)), item("b", "song", daysAgo(9)), item("c", "upload", daysAgo(30)), item("d", "words", daysAgo(1))]
    expect(unreadCount(list, ["d"], NOW)).toBe(2)
    expect(badgeCount(list, ["d"], NOW)).toBe(2)
    // without `now`, the old rule: everything not opened
    expect(unreadCount(list, ["d"])).toBe(3)
  })

  it("caps the badge at 99", () => {
    const list = Array.from({ length: 140 }, (_, i) => item(`n${i}`, "upload", NOW - i))
    expect(badgeCount(list, [], NOW)).toBe(BADGE_MAX)
  })
})

describe("sections: important first", () => {
  it("puts unread notices about uploads on top whatever their age, then Today, then Earlier", () => {
    const list = [item("t", "song", at(11, 20, 8)), item("e", "song", daysAgo(3)), item("u", "upload", daysAgo(40))]
    const sections = sectionsOf(list, NOW, [])
    expect(sections.map((s) => s.id)).toEqual(["important", "today", "earlier"])
    expect(sections[0]?.items.map((n) => n.id)).toEqual(["u"])
  })

  it("moves a notice down into Earlier once it has been read", () => {
    const list = [item("u", "upload", daysAgo(40))]
    expect(sectionsOf(list, NOW, ["u"]).map((s) => s.id)).toEqual(["earlier"])
  })

  it("has no important section when the read list is not passed", () => {
    expect(sectionsOf([item("u", "upload", daysAgo(2))], NOW).map((s) => s.id)).toEqual(["earlier"])
  })
})

describe("delete, undo and clear all", () => {
  it("undo brings a deleted item back and lets it be received again", () => {
    const one = item("a", "words", daysAgo(0))
    const state = receiveFired(EMPTY_INBOX, [one], NOW)
    const gone = removeItem(state, "a", one.firedAt)
    expect(gone.items).toEqual([])
    const back = restoreItem(gone, one, NOW)
    expect(back.items.map((n) => n.id)).toEqual(["a"])
    expect(back.deleted).toEqual({})
  })

  it("restoring twice does not duplicate", () => {
    const one = item("a", "words", daysAgo(0))
    const once = restoreItem(EMPTY_INBOX, one, NOW)
    expect(restoreItem(once, one, NOW).items).toHaveLength(1)
  })

  it("clear all removes everything but unread notices about uploads", () => {
    const list = [item("a", "song", daysAgo(0)), item("b", "words", daysAgo(1)), item("u1", "upload", daysAgo(5)), item("u2", "upload", daysAgo(6))]
    const state = { ...EMPTY_INBOX, items: list, read: ["u2", "a"] }
    expect(keptByClearAll(list, state.read)).toBe(1)
    const out = clearAll(state, NOW)
    expect(out.kept).toBe(1)
    expect(out.state.items.map((n) => n.id)).toEqual(["u1"])
    // what was cleared does not come back when the same ids fire again
    expect(Object.keys(out.state.deleted).sort()).toEqual(["a", "b", "u2"])
    expect(receiveFired(out.state, [list[0]!], NOW).items.map((n) => n.id)).toEqual(["u1"])
  })

  it("clear all on an empty list changes nothing and keeps none", () => {
    expect(clearAll(EMPTY_INBOX, NOW)).toEqual({ state: EMPTY_INBOX, kept: 0 })
  })
})

describe("grouping", () => {
  const day = (h: number, id: string, kind: NotificationKind = "words") => item(id, kind, at(11, 20, h))

  it("folds three or more of one groupable kind on one day into one row at the place of the newest", () => {
    const rows = rowsOf([day(18, "w3"), day(15, "s1", "song"), day(12, "w2"), day(9, "w1")])
    expect(rows.map((r) => r.type)).toEqual(["group", "item"])
    const g = rows[0]
    expect(g?.type === "group" && g.items.map((n) => n.id)).toEqual(["w3", "w2", "w1"])
  })

  it("leaves two as separate rows", () => {
    expect(GROUP_MIN).toBe(3)
    expect(rowsOf([day(18, "w2"), day(9, "w1")]).map((r) => r.type)).toEqual(["item", "item"])
  })

  it("does not group a kind that is not groupable, or reminders of different days", () => {
    const fest = [day(8, "f1", "festival"), day(9, "f2", "festival"), day(10, "f3", "festival")]
    expect(rowsOf(fest).every((r) => r.type === "item")).toBe(true)
    const other = [item("a", "words", at(11, 20, 9)), item("b", "words", at(11, 19, 9)), item("c", "words", at(11, 18, 9))]
    expect(rowsOf(other).every((r) => r.type === "item")).toBe(true)
  })

  it("gives a group a stable id", () => {
    const a = rowsOf([day(18, "w3"), day(12, "w2"), day(9, "w1")])[0]
    const b = rowsOf([day(18, "w3"), day(12, "w2"), day(9, "w1"), day(7, "w0")])[0]
    expect(a?.id).toBe(b?.id)
  })
})

describe("deep-link fallback", () => {
  const known = { songNumbers: new Set([1, 2, 3]), festivalIds: new Set(["guru-purnima"]) }

  it("opens a song that exists", () => {
    expect(resolveTarget({ kind: "song", target: "/song-v2/ps-2" }, known)).toEqual({ missing: false, route: "/song-v2/ps-2" })
  })

  it("falls back to the songs list when the song is gone", () => {
    const out = resolveTarget({ kind: "song", target: "/song-v2/ps-4999" }, known)
    expect(out).toMatchObject({ missing: true, route: "/v2/songs", reason: "song", asked: "/song-v2/ps-4999" })
  })

  it("does not call a song missing while the phone has no catalogue yet", () => {
    expect(resolveTarget({ kind: "song", target: "/song-v2/ps-4999" }, { songNumbers: new Set() }).missing).toBe(false)
    expect(resolveTarget({ kind: "song", target: "/song-v2/ps-4999" }).missing).toBe(false)
  })

  it("falls back to the festivals list when the festival is gone", () => {
    expect(resolveTarget({ kind: "festival", target: "/festival/guru-purnima" }, known).missing).toBe(false)
    expect(resolveTarget({ kind: "festival", target: "/festival/old-one" }, known)).toMatchObject({ missing: true, route: "/festivals", reason: "festival" })
  })

  it("never opens an address that is not an app route", () => {
    for (const bad of ["https://example.com", "//evil.test/x", "javascript:alert(1)", "", "song-v2/ps-1", null, undefined, 42]) {
      const out = resolveTarget({ kind: "announcement", target: bad }, known)
      expect(out.missing).toBe(true)
      expect(out.route).toBe("/v2/today")
    }
  })

  it("uses the kind's own fallback and handles an unknown kind", () => {
    expect(resolveTarget({ kind: "upload", target: null })).toMatchObject({ route: "/v2/kiirtan" })
    expect(resolveTarget({ kind: "from-the-future", target: "x" }).route).toBe("/v2/today")
  })

  it("lets a feature register a check for its own routes", () => {
    registerTargetCheck("/test-chords", (route) => !route.includes("deleted"))
    expect(resolveTarget({ kind: "announcement", target: "/test-chords?id=ok" }).missing).toBe(false)
    expect(resolveTarget({ kind: "announcement", target: "/test-chords?id=deleted" })).toMatchObject({ missing: true, route: "/v2/today" })
    registerTargetCheck("/test-throws", () => {
      throw new Error("boom")
    })
    expect(resolveTarget({ kind: "announcement", target: "/test-throws" }).missing).toBe(false)
  })
})

describe("the registry", () => {
  const kinds = Object.keys(KIND_META) as NotificationKind[]

  it("gives every kind a fallback route, a channel that exists, and a priority", () => {
    for (const k of kinds) {
      expect(KIND_META[k].fallback.startsWith("/")).toBe(true)
      expect(CHANNELS[channelOf(k)]).toBeDefined()
      expect(PRIORITY[k]).toBe(KIND_META[k].priority)
    }
  })

  it("keeps notices about the person's own content important, account-bound and on the loud channel", () => {
    expect(kindMeta("upload")).toMatchObject({ tier: "important", accountBound: true, channel: "notices" })
    expect(CHANNELS.notices.importance).toBe("high")
    expect(kinds.filter((k) => KIND_META[k].tier === "important")).toEqual(["upload"])
  })

  it("treats an unknown kind as a short-lived reminder from the team", () => {
    expect(kindMeta("chord-approved-from-a-newer-server")).toMatchObject({ tier: "reminder", channel: "team", accountBound: false })
  })

  it("makes iOS category ids without ':' or '-'", () => {
    for (const k of [...kinds, "x-y:z"]) expect(categoryOf(k)).toMatch(/^ps\.[A-Za-z0-9]+$/)
  })

  it("names every channel and group in every language", () => {
    for (const lang of ["en", "ru", "es"] as const) {
      for (const id of Object.keys(CHANNELS) as (keyof typeof CHANNELS)[]) expect(channelName(id, lang).length).toBeGreaterThan(2)
      expect(channelGroupName("reminders", lang).length).toBeGreaterThan(2)
      expect(channelGroupName("messages", lang).length).toBeGreaterThan(2)
      expect(privatePreviewText(lang).length).toBeGreaterThan(5)
    }
    expect(channelName("reminders", "en")).toBe("Reminders")
  })
})

describe("what the phone is handed", () => {
  const planned = { id: "song:2026-11-21@0800", kind: "song" as const, title: "Song of the day", text: "Open today's song.", target: "/v2/today" }

  it("carries the id, target and kind for the tap, a sound, a category and the interruption level", () => {
    expect(nativeContent(planned)).toEqual({
      title: "Song of the day",
      body: "Open today's song.",
      data: { id: planned.id, target: "/v2/today", kind: "song" },
      sound: true,
      categoryIdentifier: "ps.song",
      interruptionLevel: "active",
    })
  })

  it("sends the streak reminder quietly on iOS and nothing as time-sensitive", () => {
    expect(nativeContent({ ...planned, kind: "streak" }).interruptionLevel).toBe("passive")
    for (const k of Object.keys(KIND_META) as NotificationKind[]) expect(["passive", "active"]).toContain(nativeContent({ ...planned, kind: k }).interruptionLevel)
  })

  it("routes festivals, reminders and notices to their own Android channels", () => {
    expect(channelFor("festival")).toBe("festivals")
    expect(channelFor("words")).toBe("reminders")
    expect(channelFor("upload")).toBe("notices")
    expect(channelFor("announcement")).toBe("team")
  })
})

describe("rate: a day can never hold more than the limit", () => {
  it("is at most MAX_LOCAL_PER_DAY with every time of every kind switched on", () => {
    setActiveLanguage("en")
    const times = (n: number) => Array.from({ length: n }, (_, i) => (7 + i) * 60 + 5)
    const now = at(11, 20, 0, 1)
    const cards = { w: { wordId: "w", status: "review" as const, dueAt: 0, intervalDays: 1, ease: 2.5, step: 0, reps: 1, lapses: 0, lastReviewedAt: null, history: [] } }
    const input: PlanInput = {
      now,
      settings: { ...DEFAULT_SETTINGS, song: { on: true, times: times(MAX_TIMES.song) }, words: { on: true, times: times(MAX_TIMES.words).map((m) => m + 600) }, streak: { on: true } },
      songs: [],
      festivals: [{ id: "f", title: "Fest", month: 11, day: 21, year: 2026 }],
      cards,
      streak: { days: 5, reviewedToday: false },
    }
    const out = plan(input, now, at(11, 21, 0, 0) - 1)
    expect(out.length).toBeLessThanOrEqual(MAX_LOCAL_PER_DAY)
    expect(out.length).toBe(MAX_TIMES.song + MAX_TIMES.words + 2)
    expect(MAX_TIMES.song + MAX_TIMES.words + 2).toBe(MAX_LOCAL_PER_DAY)
  })
})
