import { describe, expect, it } from "vitest"

import {
  CACHE_LIMITS,
  GB,
  MB,
  allSelected,
  cacheLimitById,
  clearActionModel,
  clearedToast,
  formatBytes,
  parseCacheLimitId,
  planTrim,
  pressClearAction,
  pruneSelection,
  selectedBytes,
  sortStorageItems,
  storageLegend,
  storageRowEyebrow,
  toggleSelectAll,
  toggleSelection,
  totalBytes,
  usageRatio,
  type StorageItem,
} from "@/lib/storageCache"

function item(key: string, songNumber: number, mb: number, modifiedMs = 0): StorageItem {
  return { key, songNumber, bytes: Math.round(mb * MB), modifiedMs }
}

const sample: StorageItem[] = [
  item("a", 3, 3.7, 300),
  item("b", 1, 5.0, 100),
  item("c", 3, 4.6, 200),
  item("d", 7, 3.6, 400),
]

describe("formatBytes", () => {
  it("formats units", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(812 * 1024)).toBe("812 KB")
    expect(formatBytes(16.9 * MB)).toBe("16.9 MB")
    expect(formatBytes(250 * MB)).toBe("250 MB")
    expect(formatBytes(1.2 * GB)).toBe("1.2 GB")
  })
  it("survives bad input", () => {
    expect(formatBytes(-4)).toBe("0 B")
    expect(formatBytes(Number.NaN)).toBe("0 B")
  })
})

describe("totals and usage", () => {
  it("sums sizes and ignores negative values", () => {
    expect(totalBytes(sample)).toBe(Math.round(3.7 * MB) + Math.round(5 * MB) + Math.round(4.6 * MB) + Math.round(3.6 * MB))
    expect(totalBytes([{ ...sample[0], bytes: -5 }])).toBe(0)
    expect(totalBytes([])).toBe(0)
  })
  it("computes the usage ratio against the limit", () => {
    expect(usageRatio(250 * MB, 500 * MB)).toBeCloseTo(0.5)
    expect(usageRatio(900 * MB, 500 * MB)).toBe(1)
    expect(usageRatio(10 * MB, null)).toBe(0)
    expect(usageRatio(0, GB)).toBe(0)
    expect(usageRatio(10, 0)).toBe(0)
  })
})

describe("limits", () => {
  it("offers 500 MB, 1 GB, 2 GB, No limit", () => {
    expect(CACHE_LIMITS.map((l) => l.label)).toEqual(["500 MB", "1 GB", "2 GB", "No limit"])
    expect(cacheLimitById("none").bytes).toBeNull()
  })
  it("falls back to 1 GB for unknown stored values", () => {
    expect(parseCacheLimitId("2gb")).toBe("2gb")
    expect(parseCacheLimitId("junk")).toBe("1gb")
    expect(parseCacheLimitId(null)).toBe("1gb")
  })
  it("writes the legend", () => {
    expect(storageLegend(4, cacheLimitById("1gb"))).toBe("4 recordings · limit 1 GB")
    expect(storageLegend(1, cacheLimitById("none"))).toBe("1 recording · no limit")
  })
})

describe("sorting and eyebrows", () => {
  it("sorts by song, then newest file first", () => {
    expect(sortStorageItems(sample).map((i) => i.key)).toEqual(["b", "a", "c", "d"])
  })
  it("does not mutate its input", () => {
    const copy = [...sample]
    sortStorageItems(sample)
    expect(sample).toEqual(copy)
  })
  it("numbers versions only when a song has several files", () => {
    expect(storageRowEyebrow(sample, sample[1])).toBe("PS 1")
    expect(storageRowEyebrow(sample, sample[0])).toBe("PS 3 · Version 1")
    expect(storageRowEyebrow(sample, sample[2])).toBe("PS 3 · Version 2")
  })
})

describe("selection", () => {
  it("toggles one key", () => {
    expect(toggleSelection([], "a")).toEqual(["a"])
    expect(toggleSelection(["a", "b"], "a")).toEqual(["b"])
  })
  it("select all / deselect all", () => {
    const all = toggleSelectAll(sample, [])
    expect(all).toHaveLength(4)
    expect(allSelected(sample, all)).toBe(true)
    expect(toggleSelectAll(sample, all)).toEqual([])
    expect(toggleSelectAll(sample, ["a"])).toHaveLength(4)
    expect(allSelected([], [])).toBe(false)
  })
  it("prunes keys that no longer exist and sums selected bytes", () => {
    expect(pruneSelection(["a", "gone"], sample)).toEqual(["a"])
    expect(selectedBytes(sample, ["a", "d"])).toBe(Math.round(3.7 * MB) + Math.round(3.6 * MB))
  })
})

describe("clear action", () => {
  it("is hidden with no downloads", () => {
    expect(clearActionModel({ items: [], selected: [], armed: false })).toEqual({ visible: false })
  })
  it("is a red clear-all pill with nothing selected", () => {
    const model = clearActionModel({ items: sample, selected: [], armed: false })
    expect(model).toMatchObject({ visible: true, tone: "danger", mode: "all" })
    expect(model.visible && model.label).toMatch(/^Clear all downloads · 16\.9 MB$/)
  })
  it("asks for a second tap, with no modal", () => {
    const model = clearActionModel({ items: sample, selected: [], armed: true })
    expect(model.visible && model.label).toBe("Tap again to clear all")
  })
  it("is an orange pill with selected rows", () => {
    const model = clearActionModel({ items: sample, selected: ["a", "c"], armed: true })
    expect(model).toMatchObject({ visible: true, tone: "brand", mode: "selected" })
    expect(model.visible && model.label).toBe("Clear selected · 2 · 8.3 MB")
  })

  it("first tap arms, second tap deletes everything", () => {
    const first = pressClearAction({ items: sample, selected: [], armed: false })
    expect(first).toEqual({ armed: true, toDelete: null, freedBytes: 0 })
    const second = pressClearAction({ items: sample, selected: [], armed: true })
    expect(second.armed).toBe(false)
    expect(second.toDelete).toEqual(["a", "b", "c", "d"])
    expect(second.freedBytes).toBe(totalBytes(sample))
  })
  it("one tap deletes the selected rows only", () => {
    const press = pressClearAction({ items: sample, selected: ["a", "c", "gone"], armed: true })
    expect(press.toDelete).toEqual(["a", "c"])
    expect(press.armed).toBe(false)
    expect(clearedToast(press.freedBytes)).toBe("Cleared 8.3 MB")
  })
  it("does nothing on an empty list", () => {
    expect(pressClearAction({ items: [], selected: [], armed: true }).toDelete).toBeNull()
  })
})

describe("planTrim", () => {
  const items = [item("old", 1, 10, 1), item("mid", 2, 10, 2), item("new", 3, 10, 3)]
  it("does nothing under the limit or with no limit", () => {
    expect(planTrim(items, 30 * MB, new Set())).toEqual([])
    expect(planTrim(items, null, new Set())).toEqual([])
  })
  it("removes the oldest first until the total fits", () => {
    expect(planTrim(items, 25 * MB, new Set())).toEqual(["old"])
    expect(planTrim(items, 15 * MB, new Set())).toEqual(["old", "mid"])
  })
  it("never removes songs saved to Mine", () => {
    expect(planTrim(items, 15 * MB, new Set([1]))).toEqual(["mid", "new"])
    expect(planTrim(items, 1, new Set([1, 2, 3]))).toEqual([])
  })
})
