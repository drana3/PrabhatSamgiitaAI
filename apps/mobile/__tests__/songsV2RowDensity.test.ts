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
const MAX_DEFAULT_SLOT = 50

describe("the default song row is the small one", () => {
  it("is Compact: a 44px tile, 6px apart, no group headers", () => {
    expect(DEFAULT_ROW_STYLE).toBe("compact")
    expect(ROW_GEOMETRY.compact).toMatchObject({ row: 44, gap: 6, header: 0 })
    expect(slotHeight(DEFAULT_ROW_STYLE, "song")).toBe(50)
    expect(slotHeight(DEFAULT_ROW_STYLE, "header")).toBe(0)
  })

  it("never takes more than 50px per song, on the Songs tab or on a list page", () => {
    expect(slotHeight(DEFAULT_ROW_STYLE, "song")).toBeLessThanOrEqual(MAX_DEFAULT_SLOT)
    expect(listPageRowHeight(DEFAULT_ROW_STYLE)).toBeLessThanOrEqual(MAX_DEFAULT_SLOT)
    const rows = Array.from({ length: 5018 }, (_, i) => song(i + 1))
    const { total } = rowMetrics(rows, 0, DEFAULT_ROW_STYLE)
    expect(total).toBe(5018 * 50)
  })

  it("keeps the other looks taller than Compact, so the default stays the densest", () => {
    expect(slotHeight("tracklist", "song")).toBeGreaterThan(slotHeight("compact", "song"))
    expect(slotHeight("cards", "song")).toBeGreaterThan(slotHeight("tracklist", "song"))
  })

  it("draws no letter headers by default and the A-Z rail does not jump to them", () => {
    const mixed = [header("A"), song(1), header("B"), song(2)]
    expect(rowsForStyle(mixed, DEFAULT_ROW_STYLE).map((r) => r.kind)).toEqual(["song", "song"])
    expect(groupedForStyle(true, DEFAULT_ROW_STYLE)).toBe(false)
  })

  it("stacked rows (Saved, a playlist page) use the style's own gap", () => {
    expect(stackGap("compact")).toBe(6)
    expect(stackGap("tracklist")).toBe(0)
    expect(stackGap("cards")).toBe(10)
  })
})

describe("the Rows setting starts on the default", () => {
  it("a new phone has Compact", () => {
    expect(useListViewStore.getState().rowStyle).toBe("compact")
  })

  it("a setting saved before Compact became the default (version 1) is dropped once", async () => {
    memory.set("prabhat-list-view", JSON.stringify({ state: { rowStyle: "tracklist" }, version: 1 }))
    await useListViewStore.persist.rehydrate()
    expect(useListViewStore.getState().rowStyle).toBe("compact")
    expect(migrateListView()).toEqual({ rowStyle: "compact" })
  })

  it("a choice made now is kept", async () => {
    useListViewStore.getState().setRowStyle("cards")
    await useListViewStore.persist.rehydrate()
    expect(useListViewStore.getState().rowStyle).toBe("cards")
    useListViewStore.getState().setRowStyle("compact")
  })
})
