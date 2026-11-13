import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { webBaseUrl: "https://example.test" } } } }))

import { KIRTAN_FIXTURES } from "@/lib/fixtures/kirtan"
import {
  groupByKind,
  HUB_KINDS,
  kindCardA11y,
  kindCardLine,
  kindCards,
  kindsPresent,
  kiirtanListHref,
  listAddressOfFilter,
  listOfKind,
  onlyOnPhone,
  parseHubListParams,
  savedWithDownloads,
  typeChips,
} from "@/lib/kirtan/hub"
import { KIRTAN_TAB_CHIPS } from "@/lib/kirtan/tab"
import { filterByKind } from "@/lib/kirtan/kind"
import { RECORDING_KINDS, type Kirtan } from "@/lib/kirtan/types"
import { setActiveLanguage } from "@/lib/i18n"
import { en } from "@/locales/en"

/** Dada, 10 Nov 2026: the Kiirtan tab. Category cards with real counts, one Saved list, My uploads by kind, no Prabhat Samgiita, no Artists. */

const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8")
const k = (over: Partial<Kirtan> & { id: string }): Kirtan => ({ ...KIRTAN_FIXTURES[0], status: "published", ...over })
const published = KIRTAN_FIXTURES.filter((x) => x.status === "published")

describe("the category cards", () => {
  it("are the kinds of the page in Dada's order, and Prabhat Samgiita is not one of them", () => {
    expect(HUB_KINDS).toEqual(["kiirtan", "bhajan", "spiritual_song", "dance_song", "baba_audio", "other_mantra"])
    expect(HUB_KINDS).not.toContain("prabhat_samgiita")
    // every other kind of the app has a card: nothing is hidden except Prabhat Samgiita
    expect([...HUB_KINDS, "prabhat_samgiita"].sort()).toEqual([...RECORDING_KINDS].sort())
  })

  it("carry the real number of published recordings of the kind, and an empty kind is marked empty", () => {
    const cards = kindCards(published)
    expect(cards.map((c) => c.kind)).toEqual([...HUB_KINDS])
    for (const card of cards) {
      expect(card.count).toBe(filterByKind(published, card.kind).length)
      expect(card.empty).toBe(card.count === 0)
    }
    const two = kindCards([k({ id: "a", kind: "bhajan" }), k({ id: "b", kind: "bhajan" })])
    expect(two.find((c) => c.kind === "bhajan")).toEqual({ kind: "bhajan", count: 2, empty: false })
    expect(two.find((c) => c.kind === "kiirtan")).toEqual({ kind: "kiirtan", count: 0, empty: true })
  })

  it("count recordings of the Prabhat Samgiita kind nowhere (they stay in New recordings and on the author's page)", () => {
    const withPs = kindCards([k({ id: "ps", kind: "prabhat_samgiita" })])
    expect(withPs.reduce((n, c) => n + c.count, 0)).toBe(0)
  })

  it("say a count, or 'No recordings yet' for an empty card, in the words of the kind", () => {
    expect(kindCardLine({ kind: "bhajan", count: 1 })).toBe("1 bhajan")
    expect(kindCardLine({ kind: "kiirtan", count: 15 })).toBe("15 kiirtans")
    expect(kindCardLine({ kind: "baba_audio", count: 0 })).toBe("No recordings yet")
    expect(kindCardA11y({ kind: "bhajan", count: 8 }, "Bhajan")).toBe("Bhajan, 8 bhajans. Open the full list")
    expect(kindCardA11y({ kind: "dance_song", count: 0 }, "Dance music")).toBe("Dance music, no recordings yet. Open the list")
  })
})

describe("the chips row", () => {
  it("is All and the six kinds: no Prabhat Samgiita, no Saved, no Downloaded, no My uploads (8 became 7 with the Prabhat Samgiita chip gone)", () => {
    expect(KIRTAN_TAB_CHIPS.map((c) => c.id)).toEqual(["all", ...HUB_KINDS])
    expect(KIRTAN_TAB_CHIPS.map((c) => c.label)).not.toContain("Prabhat Samgiita")
  })
})

describe("types inside a kind", () => {
  it("are listed with their counts for Kiirtan, Bhajan and Others, and a kind without types has none", () => {
    const list = [k({ id: "1", kind: "bhajan", type: "morning" }), k({ id: "2", kind: "bhajan", type: "morning" }), k({ id: "3", kind: "bhajan", type: "evening" }), k({ id: "4", kind: "kiirtan", type: "lila" })]
    expect(typeChips(list, "bhajan").map((c) => [c.label, c.count])).toEqual([["Morning", 2], ["Evening", 1], ["Devotional", 0], ["Other", 0]])
    expect(typeChips(list, "kiirtan").find((c) => c.id === "lila")?.count).toBe(1)
    expect(typeChips(list, "dance_song")).toEqual([])
    expect(typeChips(list, "baba_audio")).toEqual([])
  })

  it("narrow the full list of a kind, or leave it whole", () => {
    const list = [k({ id: "1", kind: "bhajan", type: "morning" }), k({ id: "2", kind: "bhajan", type: "evening" }), k({ id: "3", kind: "kiirtan", type: "morning" as never })]
    expect(listOfKind(list, "bhajan", null).map((x) => x.id)).toEqual(["1", "2"])
    expect(listOfKind(list, "bhajan", "evening").map((x) => x.id)).toEqual(["2"])
  })
})

describe("Saved and Downloaded are one list", () => {
  const a = k({ id: "a" })
  const b = k({ id: "b", kind: "bhajan" })
  const c = k({ id: "c" })
  const byId = new Map<string, Kirtan>([a, b, c, k({ id: "gone", status: "removed" })].map((x) => [x.id, x]))

  it("holds what was saved in the order it was saved, then what is on the phone without a save, each once", () => {
    expect(savedWithDownloads(["b", "a"], byId, [c, a]).map((x) => x.id)).toEqual(["b", "a", "c"])
    expect(savedWithDownloads([], byId, [])).toEqual([])
  })

  it("leaves out unknown and unpublished recordings", () => {
    expect(savedWithDownloads(["zzz", "gone", "a"], byId, [byId.get("gone") as Kirtan]).map((x) => x.id)).toEqual(["a"])
  })

  it("'Only on this phone' keeps the downloaded ones, in list order", () => {
    const all = savedWithDownloads(["b", "a", "c"], byId, [c, b])
    expect(onlyOnPhone(all, [c, b]).map((x) => x.id)).toEqual(["b", "c"])
    expect(onlyOnPhone(all, [])).toEqual([])
  })

  it("offers the kinds present, in the order of the chips", () => {
    expect(kindsPresent([a, b])).toEqual(["kiirtan", "bhajan"])
    expect(kindsPresent([k({ id: "x", kind: "baba_audio" }), k({ id: "y", kind: "spiritual_song" })])).toEqual(["spiritual_song", "baba_audio"])
  })
})

describe("My uploads by kind", () => {
  it("groups every upload under the kind it was uploaded as, in the order of the chips, newest first inside a group, and hides none", () => {
    const mine = [k({ id: "1", kind: "bhajan" }), k({ id: "2", kind: "kiirtan" }), k({ id: "3", kind: "bhajan" }), k({ id: "4", kind: "prabhat_samgiita" }), k({ id: "5", kind: "kiirtan", status: "failed" })]
    const groups = groupByKind(mine)
    expect(groups.map((g) => g.kind)).toEqual(["kiirtan", "bhajan", "prabhat_samgiita"])
    expect(groups[0]!.items.map((x) => x.id)).toEqual(["2", "5"])
    expect(groups[1]!.items.map((x) => x.id)).toEqual(["1", "3"])
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(mine.length)
    expect(groupByKind([])).toEqual([])
  })
})

describe("the address of the full-list screen", () => {
  it("is built and read back", () => {
    expect(kiirtanListHref({ mode: "category", kind: "bhajan" })).toBe("/kiirtan-list?mode=category&kind=bhajan")
    expect(kiirtanListHref({ mode: "saved" })).toBe("/kiirtan-list?mode=saved")
    expect(kiirtanListHref({ mode: "saved", phone: true })).toBe("/kiirtan-list?mode=saved&phone=1")
    expect(kiirtanListHref({ mode: "mine" })).toBe("/kiirtan-list?mode=mine")
    expect(parseHubListParams({ mode: "category", kind: "dance_song" })).toEqual({ mode: "category", kind: "dance_song", phone: false })
    expect(parseHubListParams({ mode: ["saved"], phone: "1" })).toEqual({ mode: "saved", kind: "kiirtan", phone: true })
    expect(parseHubListParams({ mode: "mine" }).mode).toBe("mine")
    // anything unknown (and the removed Prabhat Samgiita card) is the first category
    expect(parseHubListParams({ mode: "zzz", kind: "prabhat_samgiita" })).toEqual({ mode: "category", kind: "kiirtan", phone: false })
    expect(parseHubListParams({})).toEqual({ mode: "category", kind: "kiirtan", phone: false })
  })

  it("keeps the old links alive: ?filter=saved, downloaded and mine open the list screen, other values stay on the tab", () => {
    expect(listAddressOfFilter("saved")).toBe("/kiirtan-list?mode=saved")
    expect(listAddressOfFilter(["downloaded"])).toBe("/kiirtan-list?mode=saved&phone=1")
    expect(listAddressOfFilter("mine")).toBe("/kiirtan-list?mode=mine")
    expect(listAddressOfFilter("bhajan")).toBeNull()
    expect(listAddressOfFilter(undefined)).toBeNull()
    // the three places that link to the old chips still do
    expect(read("lib/library/yourLibrary.ts")).toContain("/v2/kiirtan?filter=saved")
    expect(read("lib/kirtan/uploadExit.ts")).toContain("/v2/kiirtan?filter=mine")
  })
})

describe("the screen", () => {
  const screen = read("app/kiirtan.tsx")

  it("draws the slim strip only while a broadcast is on the air, and keeps the full Live and upcoming shelf below the categories", () => {
    expect(screen).toContain('phaseNow(b) === "now"')
    expect(screen.indexOf("{nowStrip()}")).toBeGreaterThan(-1)
    expect(screen.indexOf("<KindCards")).toBeLessThan(screen.indexOf("<BroadcastsShelf"))
    expect(read("components/kirtan/hub/BroadcastNowStrip.tsx")).toContain('t("kt.live.strip")')
  })

  it("has no Artists to listen to, no By type cards and no Prabhat Samgiita on the page", () => {
    expect(screen).not.toContain("ArtistChip")
    expect(screen).not.toContain("kt.artists")
    expect(screen).not.toContain("typeCards(")
    expect(screen).not.toContain("prabhat_samgiita")
    expect(screen).toContain("<AuthorsShelf")
  })

  it("shows My Kiirtan (Saved, My uploads) at the very end and opens the list screen from the cards and the tiles", () => {
    expect(screen).toContain("<MineTiles")
    expect(screen.lastIndexOf("{mineTiles()}")).toBeGreaterThan(screen.indexOf("<AuthorsShelf"))
    expect(screen).toContain('kiirtanListHref({ mode: "category", kind: k })')
    expect(screen).toContain('kiirtanListHref({ mode: "saved" })')
    expect(screen).toContain('kiirtanListHref({ mode: "mine" })')
    expect(screen).toContain("<Redirect")
  })

  it("the list screen has the switch, the arrow note, the kind pills and the groups of My uploads", () => {
    const list = read("app/kiirtan-list.tsx")
    expect(list).toContain('accessibilityRole="switch"')
    expect(list).toContain('t("kh.list.onPhone")')
    expect(list).toContain("groupByKind(submissions)")
    expect(list).toContain("savedWithDownloads(")
    expect(list).toContain("<KirtanRow")
  })

  it("a download is a save: the download start saves the Kiirtan", () => {
    expect(read("lib/offline/downloadActions.ts")).toContain("saveKiirtanOnDownload(")
  })
})

describe("the words", () => {
  it("spell Kiirtan with two i's and exist in English, Russian and Spanish", () => {
    const keys = Object.keys(en).filter((key) => key.startsWith("kh."))
    expect(keys.length).toBeGreaterThan(30)
    for (const key of keys) expect((en as Record<string, string>)[key]).not.toMatch(/Kirtan/i)
    setActiveLanguage("ru")
    expect(kindCardLine({ kind: "baba_audio", count: 0 })).toBe("Записей пока нет")
    setActiveLanguage("es")
    expect(kindCardLine({ kind: "baba_audio", count: 0 })).toBe("Aún no hay grabaciones")
    setActiveLanguage("en")
  })
})
