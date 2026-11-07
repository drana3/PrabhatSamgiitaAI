import { describe, expect, it, vi } from "vitest"

const memory = new Map<string, string>()
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: async (key: string) => {
      memory.delete(key)
    },
  },
}))

import type { CatalogEntry } from "@/lib/songsV2/entry"
import { rowMetrics } from "@/lib/songsV2/layout"
import {
  DEFAULT_ROW_STYLE,
  groupedForStyle,
  listPageRowHeight,
  ROW_GEOMETRY,
  rowsForStyle,
  slotHeight,
  stackGap,
} from "@/lib/songsV2/rowStyles"
import type { ListRow } from "@/lib/songsV2/sort"
import { migrateListView, useListViewStore } from "@/stores/listViewStore"

/**
 * Pins how much room a song row takes. Dada chose the small list (Compact: a narrow tile, no grouping) for every
 * song list, and the Songs page once came back as the taller Tracklist because the default was left on the
 * first look. These numbers are the design: change one only when the design changes.
 */

const song = (number: number): ListRow => ({
  kind: "song",
  id: `s:${number}`,
  entry: { number, title: `Song ${number}` } as CatalogEntry,
  groupIndex: 0,
  railLabel: `PS ${number}`,
})
const header = (label: string): ListRow => ({ kind: "header", id: `h:${label}`, label, groupIndex: 0 })

/** Slot height of the default look: the most a song may take on any list. */
const MAX_DEFAULT_SLOT = 56

describe("the default song row is the Tracklist", () => {
  it("is Tracklist: a 56px row, no gap, hairline between rows", () => {
    expect(DEFAULT_ROW_STYLE).toBe("tracklist")
    expect(ROW_GEOMETRY.tracklist).toMatchObject({ row: 56, gap: 0 })
    expect(slotHeight(DEFAULT_ROW_STYLE, "song")).toBe(56)
  })

  it("never takes more than 56px per song, on the Songs tab or on a list page", () => {
    expect(slotHeight(DEFAULT_ROW_STYLE, "song")).toBeLessThanOrEqual(MAX_DEFAULT_SLOT)
    expect(listPageRowHeight(DEFAULT_ROW_STYLE)).toBeLessThanOrEqual(MAX_DEFAULT_SLOT)
    const rows = Array.from({ length: 5018 }, (_, i) => song(i + 1))
    const { total } = rowMetrics(rows, 0, DEFAULT_ROW_STYLE)
    expect(total).toBe(5018 * 56)
  })

  it("keeps Cards taller than the Tracklist and Compact the smallest", () => {
    expect(slotHeight("tracklist", "song")).toBeGreaterThan(slotHeight("compact", "song"))
    expect(slotHeight("cards", "song")).toBeGreaterThan(slotHeight("tracklist", "song"))
  })

  it("Compact draws no letter headers and the A-Z rail does not jump to them", () => {
    const mixed = [header("A"), song(1), header("B"), song(2)]
    expect(rowsForStyle(mixed, "compact").map((r) => r.kind)).toEqual(["song", "song"])
    expect(groupedForStyle(true, "compact")).toBe(false)
  })

  it("stacked rows (Saved, a playlist page) use the style's own gap", () => {
    expect(stackGap("compact")).toBe(6)
    expect(stackGap("tracklist")).toBe(0)
    expect(stackGap("cards")).toBe(10)
  })
})

describe("the Rows setting starts on the default", () => {
  it("a new phone has the Tracklist", () => {
    expect(useListViewStore.getState().rowStyle).toBe("tracklist")
  })

  it("a setting saved before the Tracklist became the default (version 2) is dropped once", async () => {
    memory.set("prabhat-list-view", JSON.stringify({ state: { rowStyle: "compact" }, version: 2 }))
    await useListViewStore.persist.rehydrate()
    expect(useListViewStore.getState().rowStyle).toBe("tracklist")
    expect(migrateListView()).toEqual({ rowStyle: "tracklist" })
  })

  it("a choice made now is kept", async () => {
    useListViewStore.getState().setRowStyle("cards")
    await useListViewStore.persist.rehydrate()
    expect(useListViewStore.getState().rowStyle).toBe("cards")
    useListViewStore.getState().setRowStyle("tracklist")
  })
})
