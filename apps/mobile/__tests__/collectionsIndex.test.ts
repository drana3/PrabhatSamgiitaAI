import { describe, expect, it } from "vitest"

import { allCollections, type CollectionItem } from "@/data/collections"
import {
  buildCollectionEntries,
  collectionHref,
  collectionsCountLabel,
  filterCollections,
  kindChips,
  kindOfCategory,
  normalizeText,
} from "@/lib/songsV2/collectionsIndex"

const item = (label: string, category: string, count: number): CollectionItem => ({
  label,
  category,
  value: label.toLowerCase(),
  count,
  songNumbers: Array.from({ length: count }, (_, i) => i + 1),
})
const moods = [
  { id: "devotional", label: "Kiirtan", count: 10 },
  { id: "meditation", label: "Dhyána", count: 6 },
  { id: "children", label: "Children", count: 4 },
]
const items = [
  item("Spring Songs", "season", 7),
  item("Dipavali Songs", "festival", 12),
  item("Alpha Songs", "festival", 12),
  item("Small Songs", "festival", 2),
  item("Empty Songs", "theme", 0),
  item("Children Songs", "occasion", 4),
  item("Hindi Songs", "language", 12),
  item("Wedding Songs", "occasion", 5),
  item("Odd Songs", "mystery", 3),
]

describe("collections index", () => {
  const entries = buildCollectionEntries(items, moods)

  it("puts moods first, then festival, theme, occasion, season, language; bigger first, then A to Z", () => {
    expect(entries.map((e) => e.label)).toEqual([
      "Kiirtan",
      "Dhyána",
      "Children",
      "Alpha",
      "Dipavali",
      "Small",
      "Odd",
      "Wedding",
      "Spring",
      "Hindi",
    ])
  })
  it("drops empty collections and a collection named like a mood", () => {
    expect(entries.some((e) => e.label === "Empty")).toBe(false)
    expect(entries.filter((e) => e.label === "Children")).toHaveLength(1)
    expect(entries.find((e) => e.label === "Children")?.kind).toBe("mood")
  })
  it("keeps the id the collection page understands and a stable tone index", () => {
    expect(entries[0]).toMatchObject({ id: "devotional", countLabel: "10 songs", toneIndex: 0 })
    expect(entries.find((e) => e.label === "Spring")).toMatchObject({ id: "Spring Songs", kind: "season" })
    expect(entries.map((e) => e.toneIndex)).toEqual(entries.map((_, i) => i))
  })
  it("unknown categories are themes", () => {
    expect(kindOfCategory("mystery")).toBe("theme")
    expect(kindOfCategory("festival")).toBe("festival")
  })
  it("searches by name, ignoring accents, case and extra words", () => {
    expect(filterCollections(entries, "dhyana").map((e) => e.label)).toEqual(["Dhyána"])
    expect(filterCollections(entries, "  SPR ").map((e) => e.label)).toEqual(["Spring"])
    expect(filterCollections(entries, "zzz")).toEqual([])
    expect(filterCollections(entries, "")).toHaveLength(entries.length)
  })
  it("filters by kind and combines with the query", () => {
    expect(filterCollections(entries, "", "festival").map((e) => e.label)).toEqual(["Alpha", "Dipavali", "Small"])
    expect(filterCollections(entries, "alp", "festival").map((e) => e.label)).toEqual(["Alpha"])
    expect(filterCollections(entries, "alp", "season")).toEqual([])
  })
  it("chips list only kinds that exist, in order", () => {
    expect(kindChips(entries).map((c) => `${c.id}:${c.count}`)).toEqual([
      "all:10",
      "festival:3",
      "theme:1",
      "mood:3",
      "occasion:1",
      "season:1",
      "language:1",
    ])
    expect(kindChips(buildCollectionEntries([], [])).map((c) => c.id)).toEqual(["all"])
  })
  it("count label and href", () => {
    expect(collectionsCountLabel(68, 68)).toBe("68 collections")
    expect(collectionsCountLabel(1, 1)).toBe("1 collection")
    expect(collectionsCountLabel(3, 68)).toBe("3 of 68")
    expect(collectionHref({ id: "Spring Songs", label: "Spring" })).toBe("/songs-v2-collection?id=Spring%20Songs&title=Spring")
  })
  it("normalizeText", () => {
    expect(normalizeText("Ánanda  Púrńimá!")).toBe("ananda purnima")
  })
  it("works on the real data: nothing lost but empty ones", () => {
    const real = buildCollectionEntries(allCollections, moods)
    expect(real.length).toBeGreaterThan(50)
    expect(real.every((e) => e.count >= 0 && e.label.length > 0)).toBe(true)
    expect(new Set(real.map((e) => e.id)).size).toBe(real.length)
  })
})
