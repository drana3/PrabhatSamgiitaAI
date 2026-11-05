import { describe, expect, it } from "vitest"

import type { CollectionItem } from "@/data/collections"
import { allCollections, collectionCount, collectionGroups } from "@/data/collections"
import {
  adjacentSameTone,
  allCollectionsLabel,
  filterCollectionGroups,
  festivalChips,
  pickFestival,
  readMinutes,
  shortCollectionLabel,
  songCountLabel,
  SPECIAL_TILES,
  storyEyebrow,
  tilesWithCounts,
} from "@/lib/songsV2/collections"
import { buildSavedRows, downloadsSummary, MINE_COPY, playlistEyebrow, sectionState } from "@/lib/songsV2/mine"
import { isSongChip, legacySourceRedirect, parseSongChip, SONG_CHIPS } from "@/lib/songsV2/segments"
import type { CatalogEntry } from "@/lib/songsV2/entry"

function item(label: string, category: string, count: number): CollectionItem {
  return { label, category, value: label.toLowerCase(), count, songNumbers: Array.from({ length: count }, (_, i) => i + 1) }
}

describe("festival chips", () => {
  const items = [item("Spring Songs", "season", 7), item("Alpha Songs", "festival", 2), item("Beta Day Songs", "festival", 5), item("Empty", "festival", 0)]
  it("keeps only non-empty festivals, biggest first", () => {
    const chips = festivalChips(items)
    expect(chips.map((c) => c.label)).toEqual(["Beta Day", "Alpha"])
    expect(chips[0].eyebrow).toBe("Festival · 5 songs")
  })
  it("picks by id and falls back to the first", () => {
    const chips = festivalChips(items)
    expect(pickFestival(chips, "alpha songs")?.label).toBe("Alpha")
    expect(pickFestival(chips, "gone")?.label).toBe("Beta Day")
    expect(pickFestival([], null)).toBeNull()
  })
  it("works on the real data", () => {
    const chips = festivalChips(allCollections)
    expect(chips.length).toBeGreaterThan(0)
    expect(chips.every((c) => c.count > 0)).toBe(true)
  })
  it("shortens labels and counts", () => {
    expect(shortCollectionLabel("Dipavali (Colour Festival) Day Songs")).toBe("Dipavali (Colour Festival) Day")
    expect(shortCollectionLabel("Year-end Song")).toBe("Year-end")
    expect(songCountLabel(1)).toBe("1 song")
    expect(songCountLabel(8)).toBe("8 songs")
  })
})

describe("special tiles", () => {
  it("has the six tiles of the spec and no clashing neighbours", () => {
    expect(SPECIAL_TILES.map((t) => t.label)).toEqual(["Kiirtan", "Dhyána", "Morning", "Evening", "Nature", "Children"])
    expect(adjacentSameTone(SPECIAL_TILES)).toBe(0)
  })
  it("attaches counts", () => {
    const out = tilesWithCounts(SPECIAL_TILES, (id) => (id === "morning" ? 61 : -3))
    expect(out.find((t) => t.id === "morning")?.countLabel).toBe("61 songs")
    expect(out.find((t) => t.id === "nature")?.count).toBe(0)
  })
  it("detects a clash", () => {
    expect(adjacentSameTone([{ ...SPECIAL_TILES[0] }, { ...SPECIAL_TILES[0] }])).toBe(1)
  })
})

describe("story eyebrow", () => {
  it("computes read time", () => {
    expect(readMinutes(["word ".repeat(400)])).toBe(2)
    expect(readMinutes([])).toBe(1)
  })
  it("formats the eyebrow", () => {
    expect(storyEyebrow(4)).toBe("Story · 4 min read")
    expect(storyEyebrow(null)).toBe("Story")
  })
})

describe("Mine", () => {
  const entries = new Map<number, CatalogEntry>([
    [3, { number: 3, title: "Ándhára", firstLine: null, category: "x", language: null, durationSeconds: 271, hasAudio: null, hasDevanagari: null, addedRank: null, plays: null }],
  ])
  it("never shows a spinner and an empty state together", () => {
    expect(sectionState({ loading: true, count: 0 })).toBe("loading")
    expect(sectionState({ loading: false, count: 0 })).toBe("empty")
    expect(sectionState({ loading: true, count: 2 })).toBe("ready")
    expect(sectionState({ loading: false, count: 2 })).toBe("ready")
  })
  it("builds saved rows newest first with offline marker and unknown songs", () => {
    const rows = buildSavedRows({ savedNumbers: [3, 9, 3], entries, offlineNumbers: new Set([3]) })
    expect(rows.map((r) => r.number)).toEqual([3, 9])
    expect(rows[0].eyebrow).toBe("PS 3 · 4:31 · Offline")
    expect(rows[0].entry.title).toBe("Ándhára")
    expect(rows[1].entry.number).toBe(9)
    expect(rows[1].title).toBe("Prabhat Samgiita 9")
  })
  it("has the fixed copy", () => {
    expect(MINE_COPY.savedEmpty).toBe("Tap the heart on any song to keep it here.")
    expect(MINE_COPY.playlistCaption.startsWith("A playlist is a list of songs you put together yourself")).toBe(true)
    expect(playlistEyebrow(9)).toBe("9 songs · made by you")
    expect(playlistEyebrow(1)).toBe("1 song · made by you")
  })
  it("summarises downloads", () => {
    expect(downloadsSummary(0)).toBe("Nothing downloaded")
    expect(downloadsSummary(1)).toBe("1 recording")
    expect(downloadsSummary(4)).toBe("4 recordings")
  })
})

describe("song chips (one navigation layer)", () => {
  it("has All, Saved, Downloaded, Playlists", () => {
    expect(SONG_CHIPS.map((c) => c.label)).toEqual(["All", "Saved", "Downloaded", "Playlists"])
    expect(isSongChip("saved")).toBe(true)
    expect(isSongChip("kirtan")).toBe(false)
  })
  it("parses the query parameter and keeps old links working", () => {
    expect(parseSongChip("downloaded")).toBe("downloaded")
    expect(parseSongChip(["playlists"])).toBe("playlists")
    expect(parseSongChip("mine")).toBe("saved")
    expect(parseSongChip("collections")).toBe("all")
    expect(parseSongChip("zzz")).toBe("all")
    expect(parseSongChip(undefined)).toBe("all")
  })
  it("sends the removed Kirtan and Mixes sources to the Kiirtan tab", () => {
    expect(legacySourceRedirect("kirtan")).toBe("/v2/kiirtan")
    expect(legacySourceRedirect(["mixes"])).toBe("/v2/kiirtan")
    expect(legacySourceRedirect("ps")).toBeNull()
    expect(legacySourceRedirect(undefined)).toBeNull()
  })
})

describe("All collections index", () => {
  it("labels the entry point with the real total", () => {
    expect(allCollectionsLabel(collectionCount)).toBe(`All ${collectionCount}`)
    expect(collectionCount).toBe(68)
  })
  it("keeps every collection with an empty query", () => {
    const total = filterCollectionGroups(collectionGroups, "").reduce((n, g) => n + g.items.length, 0)
    expect(total).toBe(collectionCount)
  })
  it("matches a collection by name and drops empty groups", () => {
    const out = filterCollectionGroups(collectionGroups, "sanskrit")
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((g) => g.items.length > 0)).toBe(true)
    expect(out.flatMap((g) => g.items).some((i) => i.label === "Sanskrit Songs")).toBe(true)
  })
  it("keeps a whole group when its title matches", () => {
    const festivals = collectionGroups.find((g) => g.id === "festival")!
    const out = filterCollectionGroups(collectionGroups, "festivals")
    expect(out.find((g) => g.id === "festival")?.items).toHaveLength(festivals.items.length)
  })
  it("returns nothing for a query that matches nothing", () => {
    expect(filterCollectionGroups(collectionGroups, "zzzzqq")).toEqual([])
  })
})
