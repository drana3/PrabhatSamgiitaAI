import { describe, expect, it } from "vitest"

import { chordsModeAfterQuery, initialChordsMode, splitByChords, toggleChordsMode } from "@/lib/searchCards/chordsMode"
import { applyFilters, buildFilterRows, selectedCount, toggleFilter } from "@/lib/searchCards/filters"
import type { SearchBySection } from "@/lib/searchMenu/searchBy"

/** "Songs with chords first": on by itself for guitar words, off with one tap, the songs with chords as their own block. */

describe("the switch turns itself on for a query that asks for chords", () => {
  it.each(["bandhu guitar", "chords for 1", "capo 2", "ukulele", "гитара", "аккорды", "Guitarra", "acordes"])("%s", (query) => {
    expect(initialChordsMode(query)).toEqual({ on: true, auto: true })
  })
  it("stays off for other queries", () => {
    for (const q of ["", "bandhu", "baba nam kevalam", "calm"]) expect(initialChordsMode(q)).toEqual({ on: false, auto: false })
  })
  it("turns on when the word is typed", () => {
    expect(chordsModeAfterQuery({ on: false, auto: false }, "bandhu", "bandhu guitar")).toEqual({ on: true, auto: true })
  })
  it("turns on again for a new guitar query after the person turned it off", () => {
    const off = toggleChordsMode(initialChordsMode("bandhu guitar"))
    expect(off).toEqual({ on: false, auto: false })
    expect(chordsModeAfterQuery(off, "bandhu", "bandhu chords")).toEqual({ on: true, auto: true })
  })
  it("goes off again when the word goes, but only if the word had turned it on", () => {
    expect(chordsModeAfterQuery({ on: true, auto: true }, "bandhu guitar", "bandhu")).toEqual({ on: false, auto: false })
    expect(chordsModeAfterQuery({ on: true, auto: false }, "bandhu guitar", "bandhu")).toEqual({ on: true, auto: false })
  })
  it("a query that keeps its word changes nothing (typing more letters does not flip it)", () => {
    const off = { on: false, auto: false }
    expect(chordsModeAfterQuery(off, "bandhu guitar", "bandhu guitar 1")).toBe(off)
  })
})

describe("one tap", () => {
  it("turns it off, and the same tap turns it on for any query; a tap is the person's own choice", () => {
    const auto = initialChordsMode("guitar")
    const off = toggleChordsMode(auto)
    expect(off).toEqual({ on: false, auto: false })
    expect(toggleChordsMode(off)).toEqual({ on: true, auto: false })
  })
  it("a switch the person turned on by hand does not turn itself off when the query changes", () => {
    const manual = toggleChordsMode({ on: false, auto: false })
    expect(chordsModeAfterQuery(manual, "bandhu", "calm")).toBe(manual)
  })
})

describe("the With chords block", () => {
  const rows = [{ n: 6 }, { n: 1 }, { n: 24 }, { n: 3 }]
  it("puts the songs with chords in their own block, keeping the order inside both", () => {
    const split = splitByChords(rows, (r) => r.n, new Set([1, 3]))
    expect(split.withChords.map((r) => r.n)).toEqual([1, 3])
    expect(split.rest.map((r) => r.n)).toEqual([6, 24])
  })
  it("splits nothing while the list of songs with chords is not known (offline), and loses no song", () => {
    const split = splitByChords(rows, (r) => r.n, null)
    expect(split.withChords).toEqual([])
    expect(split.rest.map((r) => r.n)).toEqual([6, 1, 24, 3])
  })
  it("an empty set splits nothing either, all songs stay in the rest", () => {
    const split = splitByChords(rows, (r) => r.n, new Set())
    expect(split.withChords).toEqual([])
    expect(split.rest.length).toBe(4)
  })
})

describe("Filters", () => {
  const sections: SearchBySection[] = [
    {
      id: "kiirtan",
      title: "Kiirtan",
      rows: [
        { id: "style", title: "Style", values: [{ key: "kiirtan:style:bengali", label: "Bengali", count: 4 }, { key: "kiirtan:style:folk", label: "Folk", count: 0 }] },
        { id: "mood", title: "Mood", values: [{ key: "theme:calm", label: "Calm", count: 2 }] },
        { id: "instrument", title: "Instrument", values: [{ key: "facet:instrument:harmonium", label: "Harmonium", count: 3 }] },
        { id: "tempo", title: "Tempo", values: [] },
      ],
    },
  ]
  const authors = [
    { key: "a", name: "Anna", recordings: 2 },
    { key: "b", name: "Bram", recordings: 9 },
    { key: "c", name: "Cleo", recordings: 0 },
  ]
  it("has Style, Instrument and Performer here: Tempo has no choice so it is not shown, Mood is not a filter", () => {
    const rows = buildFilterRows(sections, authors)
    expect(rows.map((r) => r.id)).toEqual(["style", "instrument", "performer"])
    expect(rows[0].options).toEqual([{ shelfId: "kiirtan:style:bengali", label: "Bengali", count: 4 }])
    expect(rows[2].options.map((o) => o.label)).toEqual(["Bram", "Anna"])
    expect(rows[2].options[0].shelfId).toBe("author:b")
  })
  it("shows no row at all when the library carries nothing", () => {
    expect(buildFilterRows([], [])).toEqual([])
  })
  it("one choice per row; the same choice again takes it off", () => {
    let sel = toggleFilter({}, "style", "kiirtan:style:bengali")
    expect(selectedCount(sel)).toBe(1)
    sel = toggleFilter(sel, "style", "kiirtan:style:folk")
    expect(sel.style).toBe("kiirtan:style:folk")
    sel = toggleFilter(sel, "style", "kiirtan:style:folk")
    expect(selectedCount(sel)).toBe(0)
  })
  it("keeps the recordings that sit on every chosen shelf", () => {
    const items = [{ id: "1" }, { id: "2" }, { id: "3" }]
    const ids: Record<string, string[]> = { "kiirtan:style:bengali": ["1", "2"], "author:b": ["2", "3"] }
    const idsOf = (shelf: string) => new Set(ids[shelf] ?? [])
    expect(applyFilters(items, {}, idsOf)).toEqual(items)
    expect(applyFilters(items, { style: "kiirtan:style:bengali" }, idsOf).map((i) => i.id)).toEqual(["1", "2"])
    expect(applyFilters(items, { style: "kiirtan:style:bengali", performer: "author:b" }, idsOf).map((i) => i.id)).toEqual(["2"])
    expect(applyFilters(items, { style: "kiirtan:style:unknown" }, idsOf)).toEqual([])
  })
})
