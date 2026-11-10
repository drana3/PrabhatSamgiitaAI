import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}))
vi.mock("@/lib/client", () => ({ api: { fetchSongs: vi.fn() } }))

import type { SongSummary } from "@prabhat/core"

import { pageSongs } from "@/lib/catalog"
import { withFixtureStats } from "@/lib/fixtures/songs"
import { hasPlayableAudio } from "@/lib/playableAudio"
import { applyFilters, EMPTY_FILTERS } from "@/lib/songsV2/filters"
import { summaryToEntry, type CatalogEntry } from "@/lib/songsV2/entry"
import { availableSortOptions, buildRows, SORT_OPTIONS } from "@/lib/songsV2/sort"
import { searchLocal } from "@/lib/unifiedSearch"

/** The whole catalog: one SongSummary per song, built from the bundled search index (5,018 rows). */
const index = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../data/generated/lyric_search_index.json"), "utf8"),
) as Array<{ n: number; t: string; o: string }>
const summaries: SongSummary[] = index.map((r) => ({ number: r.n, title: r.t, first_line: r.o, is_verified: true }) as SongSummary)
// the sample stats (demo preview only) give every sort order something to sort by, so the scale test uses them
// every seventh song has chords, so the "With chords first" sort has something to sort by
const entries: CatalogEntry[] = summaries.map((row) => ({ ...withFixtureStats(summaryToEntry(row, { hasAudio: hasPlayableAudio }), true), hasChords: row.number % 7 === 0 }))

const stamp = () => performance.now()
const timings: Record<string, number> = {}

describe("the Songs list at the size of the real catalog", () => {
  it("has 5,018 distinct songs numbered 1 to 5018", () => {
    expect(entries).toHaveLength(5018)
    expect(new Set(entries.map((e) => e.number)).size).toBe(5018)
    expect(entries[0]?.number).toBe(1)
    expect(entries[5017]?.number).toBe(5018)
  })

  it("offers every sort and puts every song in each of them exactly once", () => {
    const options = availableSortOptions(entries)
    expect(options.map((o) => o.key)).toEqual(SORT_OPTIONS.map((o) => o.key))
    for (const option of options) {
      const t0 = stamp()
      const { rows, groups } = buildRows(entries, option.key)
      timings[`sort:${option.key}`] = stamp() - t0
      const songs = rows.filter((r) => r.kind === "song")
      expect(songs).toHaveLength(5018)
      expect(new Set(songs.map((r) => (r.kind === "song" ? r.entry.number : 0))).size).toBe(5018)
      if (option.key === "num") expect(groups).toHaveLength(0)
      if (option.key === "az") expect(groups.length).toBeGreaterThan(20)
      expect(timings[`sort:${option.key}`]).toBeLessThan(1500)
    }
    if (process.env.PS_TIMINGS) console.info("sort ms", JSON.stringify(timings))
  })

  it("filters by audio without losing the songs that have audio", () => {
    const t0 = stamp()
    const withAudio = applyFilters(entries, { ...EMPTY_FILTERS, hasAudio: true })
    timings.filter = stamp() - t0
    expect(withAudio.length).toBe(entries.filter((e) => e.hasAudio !== false).length)
    expect(withAudio.length).toBeGreaterThan(3500)
    expect(withAudio.length).toBeLessThan(5018)
    expect(timings.filter).toBeLessThan(500)
  })

  it("pages the list 40 rows at a time", () => {
    expect(pageSongs(entries, 1)).toHaveLength(40)
    expect(pageSongs(entries, 126)).toHaveLength(5018 < 126 * 40 ? 5018 : 126 * 40)
  })

  it("never says a song has audio unless the audio list does", () => {
    for (const entry of entries) expect(entry.hasAudio).toBe(hasPlayableAudio(entry.number))
    expect(entries.some((e) => e.hasAudio === false)).toBe(true)
  })
})

describe("search over the whole catalog", () => {
  const first = (query: string) => searchLocal(query).groups.flatMap((g) => g.items.map((i) => i.song.number))

  it("finds a song by its number, any of the 5,018", () => {
    for (let n = 1; n <= 5018; n += 53) expect(first(String(n))).toEqual([n])
    expect(first("4999")).toEqual([4999])
    expect(first("5018")).toEqual([5018])
    expect(searchLocal("5019").total).toBe(0)
  })

  it("finds a song by its first line (sampled across the catalog)", { timeout: 60_000 }, () => {
    const t0 = stamp()
    let checked = 0
    for (let i = 0; i < index.length; i += 211) {
      const row = index[i]!
      if (row.o.trim().length < 12) continue
      checked += 1
      expect(first(row.o), `PS ${row.n}: ${row.o}`).toContain(row.n)
    }
    timings.searchFirstLine = (stamp() - t0) / Math.max(1, checked)
    expect(checked).toBeGreaterThan(15)
    if (process.env.PS_TIMINGS) console.info("search first line ms/query", timings.searchFirstLine.toFixed(1))
  })

  it("finds 'jharana' without the diacritics", () => {
    const hits = first("jharana")
    expect(hits.length).toBeGreaterThan(3)
    expect(hits).toContain(2)
  })
})
