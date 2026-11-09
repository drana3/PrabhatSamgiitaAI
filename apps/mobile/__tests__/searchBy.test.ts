import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/i18n", () => ({ t: (key: string) => key }))

import { aggregateRecordings } from "@/lib/searchMenu/aggregate"
import { MENU_RULES } from "@/lib/searchMenu/config"
import { buildSearchBy, SEARCH_BY_MAX_VALUES, type SearchBySection } from "@/lib/searchMenu/searchBy"
import { buildMenu } from "@/lib/searchMenu/rules"
import type { MenuRecording, MenuStats } from "@/lib/searchMenu/types"
import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { ru } from "@/locales/ru"

/** "Search by" (docs/search-menu.md section 11) and the shelf cap (section 2.3): what a person sees, and what the 14-shelf limit drops. */

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 7)
const PS = [{ kind: "mood", count: 6 }, { kind: "festival", count: 8 }]

let n = 0
const rec = (over: Partial<MenuRecording> = {}): MenuRecording => ({ kind: "kiirtan", type: "bnk", author: `Author ${n++}`, createdAt: NOW - 60 * DAY, ...over })
const many = (count: number, over: Partial<MenuRecording> = {}) => Array.from({ length: count }, () => rec(over))
const stats = (recordings: MenuRecording[]): MenuStats => aggregateRecordings(recordings, NOW, { psCollections: PS })

const input = (s: MenuStats) => ({
  stats: s,
  psKinds: [{ kind: "mood", label: "Moods", count: 6 }, { kind: "festival", label: "Festivals", count: 8 }],
  psMoods: [{ id: "longing", label: "Longing", count: 40, href: "/collection?id=longing" }],
})
const rowOf = (sections: SearchBySection[], section: string, id: string) => sections.find((x) => x.id === section)?.rows.find((r) => r.id === id)

describe("Search by: what a person can look for", () => {
  it("lists the ways to look even when nothing carries them yet, with a sentence saying when they fill", () => {
    const sections = buildSearchBy(input(stats([])))
    expect(sections.map((x) => x.id)).toEqual(["kiirtan", "ps", "bhajan"])
    expect(rowOf(sections, "kiirtan", "mood")?.values).toEqual([])
    expect(rowOf(sections, "kiirtan", "mood")?.empty).toBe("searchBy.empty.mood")
    expect(rowOf(sections, "kiirtan", "style")?.empty).toBe("searchBy.empty.style")
    for (const row of sections.flatMap((x) => x.rows)) expect(row.values.length > 0 || row.empty, row.id).toBeTruthy()
  })

  it("counts every value that exists, whatever the shelf thresholds say", () => {
    // one Kiirtan in a style, two in another: no shelf for either yet (3 needed), both are searchable
    const sections = buildSearchBy(input(stats([rec({ style: "bengali" }), rec({ style: "hindi" }), rec({ style: "hindi" }), rec({ moods: ["calm"] })])))
    const style = rowOf(sections, "kiirtan", "style")
    expect(style?.values.map((v) => [v.key, v.count])).toEqual([["kiirtan:style:hindi", 2], ["kiirtan:style:bengali", 1]])
    expect(style?.values[0].href).toBe("/browse-shelf?id=kiirtan%3Astyle%3Ahindi")
    expect(buildMenu(stats([rec({ style: "bengali" })])).shelves.some((s) => s.id.startsWith("kiirtan:style:"))).toBe(false)
    expect(rowOf(sections, "kiirtan", "mood")?.values).toEqual([expect.objectContaining({ key: "theme:calm", count: 1, href: "/browse-shelf?id=theme%3Acalm" })])
  })

  it("puts the leftover 'Other styles' last and names a style somebody typed from its own words", () => {
    const sections = buildSearchBy(input(stats([...many(5, { style: "other" }), ...many(2, { style: "other", styleOther: "Baul songs" }), rec({ style: "hindi" })])))
    const keys = rowOf(sections, "kiirtan", "style")?.values.map((v) => v.key)
    expect(keys).toEqual(["kiirtan:style:other:baul-songs", "kiirtan:style:hindi", "kiirtan:style:other"])
    expect(rowOf(sections, "kiirtan", "style")?.values[0].label).toBe("Baul Songs")
  })

  it("shows the piano once: its own list, never a second one from the instrument facet", () => {
    const library = [...many(4, { piano: true, tags: { instrument: ["piano"] } }), ...many(2, { tags: { instrument: ["guitar"] } })]
    const sections = buildSearchBy(input(stats(library)))
    const instrument = rowOf(sections, "kiirtan", "instrument")
    expect(instrument?.values.map((v) => v.key)).toEqual(["kiirtan:piano", "facet:instrument:guitar"])
    expect(instrument?.values[0]).toMatchObject({ count: 4, href: "/browse-shelf?id=kiirtan%3Apiano" })
    const shelves = buildMenu(stats(library)).shelves.map((s) => s.id)
    expect(shelves).toContain("kiirtan:piano")
    expect(shelves).not.toContain("facet:instrument:piano")
  })

  it("lists Prabhat Samgiita: collections, moods, number, first line and feeling, the last three as examples to type", () => {
    const ps = buildSearchBy(input(stats([]))).find((x) => x.id === "ps")
    expect(ps?.rows.map((r) => r.id)).toEqual(["ps-collections", "ps-mood", "ps-number", "ps-first-line", "ps-feeling"])
    expect(ps?.rows[0].values.map((v) => [v.label, v.count])).toEqual([["Moods", 6], ["Festivals", 8]])
    expect(ps?.rows[0].values[0].href).toBe("/collections-v2?kind=mood")
    expect(ps?.rows[1].values[0]).toMatchObject({ label: "Longing", count: 40, href: "/collection?id=longing" })
    expect(ps?.rows[2].values[0].query).toBe("3")
    expect(ps?.rows[3].values[0].query).toBe("bandhu he niye calo")
    expect(ps?.rows[4].values[0].query).toBe("peaceful")
    expect(ps?.rows.slice(2).every((r) => r.values.every((v) => v.href === undefined && v.query))).toBe(true)
  })

  it("adds a section for any other category the library carries, found by itself", () => {
    const sections = buildSearchBy(input(stats([...many(2, { tags: { occasion: ["wedding"] } }), ...many(2, { kind: "dance_song", type: "other", dance: "tandava" })])))
    const more = sections.find((x) => x.id === "more")
    expect(more?.rows.map((r) => r.id)).toEqual(["dance", "facet:occasion"])
    expect(more?.rows[1].values).toEqual([expect.objectContaining({ key: "facet:occasion:wedding", count: 2 })])
  })

  it("never lists more choices than a row can hold", () => {
    const styles = ["bengali", "hindi", "folk", "classical", "sufi", "pop", "rock", "jazz", "blues", "country", "reggae", "latin"]
    const sections = buildSearchBy(input(stats(styles.map((style) => rec({ style })))))
    expect(rowOf(sections, "kiirtan", "style")?.values).toHaveLength(SEARCH_BY_MAX_VALUES)
  })

  it("has every word in English, Russian and Spanish, and none of the Russian ones spells a name in Latin", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("searchBy.") || k.startsWith("recMoods."))
    expect(keys.length).toBeGreaterThan(60)
    for (const key of keys) {
      expect(Object.keys(ru), key).toContain(key)
      expect(Object.keys(es), key).toContain(key)
      expect(String((ru as Record<string, string>)[key]), key).not.toMatch(/Kiirtan|Bhajan/)
    }
  })
})

describe("the 14-shelf cap drops the shelf with the fewest recordings", () => {
  /** 2 protected shelves (New this month, Baba) and 13 others: one too many for the cap of 14. */
  function crowded(over: Partial<MenuStats> = {}): MenuStats {
    return {
      ...stats([]),
      babaAudio: 1, newInWindow: 30, psRecordings: 3, kiirtanTypes: { bnk: 50, lila: 40, festival: 30 }, kiirtanSets: 12,
      kiirtanStyles: { bengali: 25, hindi: 20 }, spiritualSongs: 14,
      bhajanLanguages: { ru: 30, en: 29, hi: 28 }, bhajanTypes: { morning: 13, evening: 15 },
      themes: [{ id: "calm", confirmed: 4 }],
      ...over,
    }
  }
  const counted = (s: MenuStats) => buildMenu(s).shelves.filter((x) => !x.id.startsWith("ps:kind:") && x.block !== "themes")
  const dropped = (s: MenuStats) => buildMenu(s).hidden.filter((h) => h.why === "over-limit").map((h) => h.id)

  it("drops the smallest shelf wherever it stands, not the last one", () => {
    const s = crowded()
    expect(counted(s)).toHaveLength(MENU_RULES.maxShelves)
    // "Prabhat Samgiita recordings" (3) is high up the menu; the last shelf (Bhajans of the morning, 13) is bigger and stays
    expect(dropped(s)).toEqual(["ps:recordings"])
    expect(counted(s).at(-1)?.id).toBe("bhajan:type:morning")
  })

  it("takes the lower of two shelves with the same number", () => {
    const s = crowded({ psRecordings: 9, spiritualSongs: 9 })
    expect(dropped(s)).toEqual(["spiritual"])
  })

  it("never drops Baba's voice, even with one recording, nor New this month, nor the collections and moods", () => {
    const s = crowded({ babaAudio: 1, newInWindow: 3, psRecordings: 40, spiritualSongs: 40, kiirtanSets: 40, kiirtanTypes: { bnk: 50, lila: 40, festival: 30 } })
    const ids = buildMenu(s).shelves.map((x) => x.id)
    expect(ids).toEqual(expect.arrayContaining(["baba", "new", "ps:kind:mood", "ps:kind:festival", "theme:calm"]))
    expect(dropped(s)).not.toContain("baba")
    expect(dropped(s)).not.toContain("new")
  })

  it("a shelf pinned by the team is never the one dropped", () => {
    const s = crowded({ pins: ["ps:recordings"] })
    expect(dropped(s)).not.toContain("ps:recordings")
    expect(counted(s)).toHaveLength(MENU_RULES.maxShelves)
  })
})
