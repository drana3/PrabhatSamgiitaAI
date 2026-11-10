import { describe, expect, it } from "vitest"

import { coverFor } from "@/lib/homeShelves"
import { placeholderEntry, type CatalogEntry } from "@/lib/songsV2/entry"
import {
  buildPlayPlan,
  buildShufflePlan,
  collageCoverIds,
  downloadAllState,
  filterByChip,
  formatTotal,
  metaLine,
  pendingDownloads,
  shuffled,
  sortList,
  splitTitle,
  totalSeconds,
  BASE_CHIPS,
  emptyMessage,
  visibleChips,
  withoutHidden,
  type ListContext,
} from "@/lib/songsV2/listPage"

const song = (number: number, title: string, durationSeconds: number | null): CatalogEntry => ({
  ...placeholderEntry(number, title),
  durationSeconds,
})

const entries = [song(3, "Ándhára Sheśe", 271), song(1, "Bandhu He Niye Calo", 238), song(6, "Bandhu Ámár", 300), song(9, "Elo Anek", null)]

const ctx: ListContext = {
  saved: new Set([1, 3]),
  downloaded: new Set([3, 6]),
  categories: { morning: new Set([1, 3, 77]), evening: new Set([500]), festival: new Set(), meditation: new Set([6]) },
}

describe("chips", () => {
  it("filters All, Saved and a category; Only on this phone narrows Saved to the downloaded ones", () => {
    expect(filterByChip(entries, "all", ctx)).toHaveLength(4)
    expect(filterByChip(entries, "saved", ctx).map((e) => e.number)).toEqual([3, 1])
    expect(filterByChip(entries, "saved", { ...ctx, downloadedOnly: true }).map((e) => e.number)).toEqual([3])
    // the switch belongs to Saved only
    expect(filterByChip(entries, "all", { ...ctx, downloadedOnly: true })).toHaveLength(4)
    expect(filterByChip(entries, "morning", { ...ctx, downloadedOnly: true }).map((e) => e.number)).toEqual([3, 1])
    expect(filterByChip(entries, "morning", ctx).map((e) => e.number)).toEqual([3, 1])
    expect(filterByChip(entries, "nope", ctx)).toEqual([])
  })
  it("shows a category chip only when the list holds a song of it", () => {
    const ids = visibleChips(entries, ctx).map((c) => c.id)
    expect(ids).toEqual(["all", "saved", "morning", "meditation"])
  })
  it("has no Downloaded chip: Saved and downloaded are one list", () => {
    expect(BASE_CHIPS.map((c) => c.id)).toEqual(["all", "saved"])
    expect(visibleChips(entries, ctx).map((c) => c.id)).not.toContain("downloaded")
  })
  it("says why Saved is empty when only the songs on this phone are asked for", () => {
    expect(emptyMessage("saved", "Saved")).toMatch(/No saved songs/)
    expect(emptyMessage("saved", "Saved", true)).toMatch(/downloaded/i)
  })
  it("hides hidden songs", () => {
    expect(withoutHidden(entries, new Set([1, 9])).map((e) => e.number)).toEqual([3, 6])
    expect(withoutHidden(entries, new Set())).toHaveLength(4)
  })
})

describe("sort", () => {
  it("Number", () => expect(sortList(entries, "num").map((e) => e.number)).toEqual([1, 3, 6, 9]))
  it("A to Z ignores accents and leading marks", () =>
    expect(sortList(entries, "az").map((e) => e.number)).toEqual([3, 6, 1, 9]))
  it("Duration, shortest first, unknown last", () =>
    expect(sortList(entries, "duration").map((e) => e.number)).toEqual([1, 3, 6, 9]))
  it("Recently played lists the played ones newest first, then the rest by number", () =>
    expect(sortList(entries, "recent", [6, 99, 3]).map((e) => e.number)).toEqual([6, 3, 1, 9]))
  it("does not change the input", () => {
    const before = entries.map((e) => e.number)
    sortList(entries, "az")
    expect(entries.map((e) => e.number)).toEqual(before)
  })
})

describe("totals", () => {
  it("adds the known lengths", () => expect(totalSeconds(entries)).toEqual({ seconds: 809, known: 3 }))
  it("formats hours and minutes", () => {
    expect(formatTotal(15120)).toBe("4 h 12 min")
    expect(formatTotal(2280)).toBe("38 min")
    expect(formatTotal(7200)).toBe("2 h")
    expect(formatTotal(20)).toBe("1 min")
    expect(formatTotal(0)).toBeNull()
  })
  it("builds the meta line", () => {
    expect(metaLine([song(1, "a", 3600), song(2, "b", 1800)])).toBe("2 songs · 1 h 30 min")
    expect(metaLine([song(1, "a", null)])).toBe("1 song")
    expect(metaLine([])).toBe("0 songs")
  })
})

describe("play plan", () => {
  const audio = (n: number) => n !== 1
  it("returns null for an empty list", () => {
    expect(buildPlayPlan([], audio)).toBeNull()
    expect(buildShufflePlan([], audio)).toBeNull()
  })
  it("plays the list in the order shown from the first song with audio", () => {
    expect(buildPlayPlan([1, 2, 3], audio)).toEqual({ start: 2, queue: [1, 2, 3] })
  })
  it("starts at a tapped song and keeps the whole list as the queue", () => {
    expect(buildPlayPlan([5, 6, 7], () => true, 6)).toEqual({ start: 6, queue: [5, 6, 7] })
  })
  it("moves a silent tapped song on to the next one with audio", () => {
    expect(buildPlayPlan([5, 1, 7], audio, 1)).toEqual({ start: 7, queue: [5, 1, 7] })
    expect(buildPlayPlan([5, 1], audio, 1)).toEqual({ start: 1, queue: [5, 1] })
  })
  it("ignores a start that is not in the list and drops duplicates", () => {
    expect(buildPlayPlan([4, 4, 8], () => true, 99)).toEqual({ start: 4, queue: [4, 8] })
  })
  it("shuffles the same songs", () => {
    const plan = buildShufflePlan([1, 2, 3, 4, 5, 6], () => true, () => 0.3)
    expect(plan?.queue.slice().sort()).toEqual([1, 2, 3, 4, 5, 6])
    expect(plan?.start).toBe(plan?.queue[0])
  })
  it("shuffled keeps every item and is deterministic for a fixed random", () => {
    const a = shuffled([1, 2, 3, 4], () => 0.5)
    expect(a).toEqual(shuffled([1, 2, 3, 4], () => 0.5))
    expect(a.slice().sort()).toEqual([1, 2, 3, 4])
  })
})

describe("download all", () => {
  it("is idle, downloading or done", () => {
    expect(downloadAllState([1, 2], new Set([1]), new Set())).toBe("idle")
    expect(downloadAllState([1, 2], new Set([1]), new Set([2]))).toBe("downloading")
    expect(downloadAllState([1, 2], new Set([1, 2]), new Set())).toBe("done")
    expect(downloadAllState([], new Set(), new Set())).toBe("idle")
  })
  it("lists only what still needs a download", () => {
    expect(pendingDownloads([1, 2, 3, 4], new Set([1]), new Set([2]), (n) => n !== 4)).toEqual([3])
  })
})

describe("cover and title", () => {
  it("collage uses the cover formula of Home for the first songs", () => {
    const ids = collageCoverIds([1, 2, 3, 4, 5, 6])
    expect(ids).toHaveLength(4)
    expect(ids[0]).toBe(coverFor(1))
    expect(new Set(ids).size).toBe(4)
  })
  it("collage repeats pictures for a short list and is empty for none", () => {
    expect(collageCoverIds([1])).toEqual([coverFor(1), coverFor(1), coverFor(1), coverFor(1)])
    expect(collageCoverIds([])).toEqual([])
  })
  it("splits a name into a light lead and a heavy rest", () => {
    expect(splitTitle("All songs")).toEqual({ lead: "All", rest: "songs" })
    expect(splitTitle("Morning")).toEqual({ lead: "", rest: "Morning" })
    expect(splitTitle("Ánanda Púrńimá Day")).toEqual({ lead: "Ánanda", rest: "Púrńimá Day" })
  })
})
