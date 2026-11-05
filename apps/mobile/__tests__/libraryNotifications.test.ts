import { describe, expect, it } from "vitest"

import { buildLibraryItems, countLabel, filterLibrary, nextLayout } from "@/lib/libraryProposal"
import { markAllRead, markRead, sectionsOf, unreadCount, unreadIds, type AppNotification } from "@/lib/notifications"

const NOW = new Date(2026, 10, 5, 12, 0).getTime()
const n = (id: string, daysAgo: number): AppNotification => ({
  id,
  kind: "song",
  title: id,
  text: "",
  target: "/",
  firedAt: new Date(2026, 10, 5 - daysAgo, 8, 0).getTime(),
})

describe("notifications", () => {
  const items = [n("a", 0), n("b", 0), n("c", 1)]
  it("counts unread and marks one read", () => {
    expect(unreadCount(items, [])).toBe(3)
    expect(unreadIds(items, markRead([], "b"))).toEqual(["a", "c"])
    expect(markRead(["a"], "a")).toEqual(["a"])
  })
  it("marks everything read once", () => {
    expect(unreadCount(items, markAllRead(items, ["a"]))).toBe(0)
  })
  it("groups Today then Earlier and drops an empty group", () => {
    expect(sectionsOf(items, NOW).map((s) => s.label)).toEqual(["Today", "Earlier"])
    expect(sectionsOf([n("x", 3)], NOW).map((s) => s.label)).toEqual(["Earlier"])
    expect(sectionsOf([], NOW)).toEqual([])
  })
})

describe("library proposal", () => {
  const items = buildLibraryItems({ playlists: [{ id: "p1", name: "Morning", count: 12 }], savedCount: 1, downloadCount: 3, wordsDue: 3 })
  it("builds rows from real counts", () => {
    expect(items.map((i) => i.kind)).toEqual(["learning", "saved", "downloads", "playlists"])
    expect(items.find((i) => i.kind === "saved")?.sub).toBe("Saved · 1 song")
    expect(items.find((i) => i.kind === "playlists")?.target).toBe("/playlist-v2/p1")
  })
  it("skips empty collections", () => {
    expect(buildLibraryItems({ playlists: [], savedCount: 0, downloadCount: 0, wordsDue: 0 })).toEqual([])
  })
  it("filters by chip and toggles layout", () => {
    expect(filterLibrary(items, "playlists")).toHaveLength(1)
    expect(filterLibrary(items, null)).toHaveLength(4)
    expect(nextLayout("list")).toBe("grid")
    expect(nextLayout("grid")).toBe("list")
    expect(countLabel(2)).toBe("2 songs")
  })
})
