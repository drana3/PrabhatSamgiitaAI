import { formatTime } from "@/lib/i18n"
import { describe, expect, it } from "vitest"

import { migrateInbox, migrateScheduled } from "@/stores/notificationsStore"
import {
  EMPTY_INBOX,
  INBOX_KEEP_DAYS,
  markAllRead,
  pruneInbox,
  receiveFired,
  removeItem,
  sectionsOf,
  timeLabel,
  unreadCount,
  type AppNotification,
} from "@/lib/notifications"
import { announcementNotification, uploadDecisionNotification } from "@/lib/notifications/serverKinds"

const at = (d: number, h = 8, min = 0) => new Date(2026, 10, d, h, min).getTime()
const NOW = at(5, 12)
const n = (id: string, firedAt: number): AppNotification => ({ id, kind: "song", title: id, text: "", target: "/", firedAt })

describe("inbox: receiving what has fired", () => {
  it("adds new items, newest first, and stamps the sync time", () => {
    const out = receiveFired(EMPTY_INBOX, [n("a", at(4)), n("b", at(5))], NOW)
    expect(out.items.map((i) => i.id)).toEqual(["b", "a"])
    expect(out.syncedAt).toBe(NOW)
  })

  it("does not add the same id twice, so asking again changes nothing", () => {
    const once = receiveFired(EMPTY_INBOX, [n("a", at(5))], NOW)
    const twice = receiveFired(once, [n("a", at(5))], NOW + 1000)
    expect(twice.items).toHaveLength(1)
  })

  it("does not bring back an item the person deleted", () => {
    const once = receiveFired(EMPTY_INBOX, [n("a", at(5))], NOW)
    const gone = removeItem(once, "a", at(5))
    expect(gone.items).toEqual([])
    expect(receiveFired(gone, [n("a", at(5))], NOW + 1000).items).toEqual([])
  })

  it("ignores items from the future and items older than 30 days", () => {
    const out = receiveFired(EMPTY_INBOX, [n("future", NOW + 60_000), n("old", at(5) - INBOX_KEEP_DAYS * 86_400_000)], NOW)
    expect(out.items).toEqual([])
  })
})

describe("inbox: age and sections", () => {
  it("drops items past their keep time and deleted memory older than 90 days", () => {
    const old = new Date(2026, 9, 1, 8).getTime()
    const state = { ...EMPTY_INBOX, items: [n("old", old), n("new", at(4))], deleted: { x: new Date(2026, 6, 1, 8).getTime(), y: old }, read: ["old", "new"] }
    const out = pruneInbox(state, NOW)
    expect(out.items.map((i) => i.id)).toEqual(["new"])
    // the deleted memory is kept 90 days: a 35-day-old one stays, a July one goes
    expect(Object.keys(out.deleted)).toEqual(["y"])
  })

  it("shows Today and Earlier, newest first, and leaves out what is older than 30 days", () => {
    const old = new Date(2026, 9, 1, 8).getTime()
    const sections = sectionsOf([n("e", at(3)), n("t1", at(5, 8)), n("t2", at(5, 11)), n("old", old)], NOW)
    expect(sections.map((s) => s.label)).toEqual(["Today", "Earlier"])
    expect(sections[0]?.items.map((i) => i.id)).toEqual(["t2", "t1"])
    expect(sections[1]?.items.map((i) => i.id)).toEqual(["e"])
  })

  it("is empty when there is nothing", () => {
    expect(sectionsOf([], NOW)).toEqual([])
  })

  it("labels the time on a row", () => {
    // today's rows use the same clock as the settings screen ("8:00 AM" in English)
    expect(timeLabel(at(5, 8, 0), NOW)).toBe(formatTime(at(5, 8, 0)))
    expect(timeLabel(at(5, 18, 0), NOW)).toBe(formatTime(at(5, 18, 0)))
    expect(timeLabel(at(5, 18, 0), NOW)).toMatch(/6:00\s?PM/i)
    expect(timeLabel(at(4, 20), NOW)).toBe("Yesterday")
    expect(timeLabel(at(1, 20), NOW)).toBe("Sun")
    expect(timeLabel(new Date(2026, 9, 12, 8).getTime(), NOW)).toBe("12 Oct")
  })
})

describe("inbox: read state", () => {
  it("counts unread among the items and marks all read", () => {
    const items = [n("a", at(5)), n("b", at(4))]
    expect(unreadCount(items, ["a"])).toBe(1)
    expect(unreadCount(items, markAllRead(items, ["a"]))).toBe(0)
  })

  it("forgets a deleted item's read mark", () => {
    const state = { ...EMPTY_INBOX, items: [n("a", at(5))], read: ["a"] }
    expect(removeItem(state, "a", at(5)).read).toEqual([])
  })
})

describe("inbox: migration of the saved value", () => {
  it("reads the first version (only read ids) and garbage", () => {
    expect(migrateInbox({ read: ["a", 5, "b"] }, 1)).toEqual({ items: [], read: ["a", "b"], deleted: {}, syncedAt: null })
    expect(migrateInbox(undefined, 0)).toEqual(EMPTY_INBOX)
  })
})

describe("server kinds (copy only, no trigger yet)", () => {
  it("writes the upload decision in short sentences", () => {
    const ok = uploadDecisionNotification({ uploadId: "u1", title: "Sunrise Kiirtan", decision: "published", firedAt: NOW })
    expect(ok).toMatchObject({ id: "upload:u1:published", kind: "upload", title: "Kiirtan published", text: "Sunrise Kiirtan is live in the library." })
    const no = uploadDecisionNotification({ uploadId: "u2", title: "", decision: "removed", reason: "It is not yours to share.", firedAt: NOW })
    expect(no.title).toBe("Kiirtan removed")
    expect(no.text).toBe("Your Kiirtan was removed: It is not yours to share.")
    const none = uploadDecisionNotification({ uploadId: "u3", title: "Dawn", decision: "removed", firedAt: NOW })
    expect(none.text).toBe("Dawn was removed by the team. Open it to see how to answer.")
    expect(no.text.includes("!")).toBe(false)
  })

  it("wraps a team announcement", () => {
    const a = announcementNotification({ announcementId: "a1", title: "", text: " New songs. ", firedAt: NOW })
    expect(a).toMatchObject({ id: "announcement:a1", kind: "announcement", title: "From the team", text: "New songs.", target: "/v2/today" })
  })
})

describe("inbox: the ledger of what the phone was told to deliver", () => {
  it("is empty for a save from before the ledger existed and keeps valid entries", () => {
    expect(migrateScheduled({ items: [] })).toEqual([])
    expect(migrateScheduled(null)).toEqual([])
    const good = { id: "song:2026-11-05@0800", kind: "song", fireAt: at(5), title: "t", text: "x", target: "/" }
    expect(migrateScheduled({ scheduled: [good, { id: 3 }, null, "x"] })).toEqual([good])
  })
})
