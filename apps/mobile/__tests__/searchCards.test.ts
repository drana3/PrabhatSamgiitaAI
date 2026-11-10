import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/i18n", () => ({ t: (key: string) => key }))

import { STOCK_PHOTO_META } from "@/lib/photos/photoData"
import {
  KIIRTAN_MOOD_PHOTO,
  PS_MOOD_PHOTO,
  TYPE_PHOTO,
  festivalNames,
  festivalSections,
  festivalsEmpty,
  moodGroups,
  moodNames,
  typeTiles,
} from "@/lib/searchCards/browse"
import { CARD_PILLS, SEARCH_CARD_ORDER, SEARCH_CARD_PHOTO, SEARCH_CARD_TARGET, buildSearchCards, pillsOf } from "@/lib/searchCards/cards"
import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { ru } from "@/locales/ru"

/** The five wide cards of Search and the pages behind them (Dada, 10 Nov 2026, variant B of the board). */

const ROOT = path.resolve(__dirname, "..")
const APP = path.join(ROOT, "app")

function routeExists(route: string): boolean {
  const parts = route.split("/").filter(Boolean)
  const walk = (dir: string, rest: string[]): boolean => {
    if (!existsSync(dir)) return false
    const entries = readdirSync(dir)
    if (rest.length === 0) return entries.some((name) => /^index\.tsx?$/.test(name))
    const [head, ...tail] = rest
    for (const name of entries) {
      const full = path.join(dir, name)
      const isDir = statSync(full).isDirectory()
      const base = name.replace(/\.tsx?$/, "")
      if (!isDir && tail.length === 0 && /\.tsx?$/.test(name) && (base === head || /^\[.+\]$/.test(base))) return true
      if (isDir && (name === head || /^\[.+\]$/.test(name)) && walk(full, tail)) return true
      if (isDir && /^\(.+\)$/.test(name) && walk(full, rest)) return true
    }
    return false
  }
  return walk(APP, parts)
}
const stripQuery = (target: string) => target.split("?")[0]

describe("pills", () => {
  it("shows every name when they fit, else the first two and the rest as +N", () => {
    expect(pillsOf(["Calm", "Devotion"])).toEqual([{ label: "Calm", more: false }, { label: "Devotion", more: false }])
    expect(pillsOf(["a", "b", "c"]).map((p) => p.label)).toEqual(["a", "b", "c"])
    expect(pillsOf(["Calm", "Devotion", "Joy", "Longing", "Night", "Dawn"]).map((p) => p.label)).toEqual(["Calm", "Devotion", "+4"])
    expect(pillsOf(["a", "b", "c", "d"]).length).toBe(CARD_PILLS)
  })

  it("never counts an empty or repeated name, so +N is what was really left out", () => {
    const pills = pillsOf(["Calm", " calm ", "", "Joy", "Joy", "Night", "Dawn"])
    expect(pills.map((p) => p.label)).toEqual(["Calm", "Joy", "+2"])
    expect(pills[2].more).toBe(true)
    expect(pillsOf([])).toEqual([])
    expect(pillsOf(["", "  "])).toEqual([])
  })
})

describe("the five cards", () => {
  const data = { mood: ["Dhyána", "Morning", "Evening", "Nature"], collections: ["Themes"], type: [], authors: ["Priya Devi", "Ananda Group"], festivals: [] }
  const cards = buildSearchCards(data, (id) => id.toUpperCase())

  it("are Mood, Collections, Kiirtan type, Authors, Festivals, in that order", () => {
    expect(cards.map((c) => c.id)).toEqual(["mood", "collections", "type", "authors", "festivals"])
    expect(SEARCH_CARD_ORDER).toEqual(["mood", "collections", "type", "authors", "festivals"])
    expect(cards.map((c) => c.title)).toEqual(["MOOD", "COLLECTIONS", "TYPE", "AUTHORS", "FESTIVALS"])
  })

  it("carry real examples as pills, and say so when a card has none", () => {
    expect(cards[0].pills.map((p) => p.label)).toEqual(["Dhyána", "Morning", "+2"])
    expect(cards[0].spoken).toBe("Dhyána, Morning, +2")
    expect(cards[3].pills.map((p) => p.label)).toEqual(["Priya Devi", "Ananda Group"])
    expect(cards[2].empty).toBe(true)
    expect(cards[4].empty).toBe(true)
    expect(cards[0].empty).toBe(false)
  })

  it("open a page that exists", () => {
    for (const id of SEARCH_CARD_ORDER) expect(routeExists(stripQuery(SEARCH_CARD_TARGET[id])), `${id} -> ${SEARCH_CARD_TARGET[id]}`).toBe(true)
  })

  it("name their pages in the three languages", () => {
    for (const dict of [en, ru, es] as Record<string, string>[]) {
      for (const id of SEARCH_CARD_ORDER) expect(dict[`searchCards.card.${id}`], id).toBeTruthy()
    }
    // Kiirtan keeps two i's in English
    expect(en["searchCards.card.type"]).toBe("Kiirtan type")
  })
})

describe("photos: landscapes and instruments, never a person and never Baba", () => {
  const used = [
    ...Object.values(SEARCH_CARD_PHOTO),
    ...Object.values(PS_MOOD_PHOTO),
    ...Object.values(KIIRTAN_MOOD_PHOTO),
    ...Object.values(TYPE_PHOTO),
  ]
  it("every number is in the photo shortlist, shows nobody, and is not Baba", () => {
    for (const n of used) {
      const meta = STOCK_PHOTO_META.find((m) => m.n === n)
      expect(meta, `photo ${n}`).toBeTruthy()
      expect(meta?.people, `photo ${n}`).toBe("none")
      expect(meta?.subject, `photo ${n}`).not.toBe("baba")
    }
  })
  it("the instrument cards use instruments (sound) and the others use light, sky or nature", () => {
    const category = (n: number) => STOCK_PHOTO_META.find((m) => m.n === n)?.category
    expect(category(SEARCH_CARD_PHOTO.type)).toBe("sound")
    expect(category(SEARCH_CARD_PHOTO.authors)).toBe("sound")
    expect(["sky", "nature", "light", "hands"]).toContain(category(SEARCH_CARD_PHOTO.mood))
  })
})

describe("Mood page", () => {
  const input = {
    psMoods: [
      { id: "meditation", label: "Dhyána", count: 120, href: "/songs-v2-collection?id=meditation" },
      { id: "morning", label: "Morning", count: 80, href: "/songs-v2-collection?id=morning" },
      { id: "children", label: "Children", count: 0, href: "/songs-v2-collection?id=children" },
    ],
    kiirtanMoods: [
      { id: "joyful", label: "Joyful", count: 2, href: "/browse-shelf?id=theme%3Ajoyful" },
      { id: "longing", label: "Longing", count: 5, href: "/browse-shelf?id=theme%3Alonging" },
      { id: "odd", label: "Odd", count: 0, href: "/x" },
    ],
  }
  it("lists the song moods first, then the Kiirtan moods biggest first, and drops empty ones", () => {
    const g = moodGroups(input)
    expect(g.songs.map((t) => t.label)).toEqual(["Dhyána", "Morning"])
    expect(g.kiirtan.map((t) => t.label)).toEqual(["Longing", "Joyful"])
    expect(moodNames(g)).toEqual(["Dhyána", "Morning", "Longing", "Joyful"])
  })
  it("a tile opens the list of that mood and counts songs or recordings", () => {
    const g = moodGroups(input)
    expect(g.songs[0]).toMatchObject({ href: "/songs-v2-collection?id=meditation", unit: "songs", count: 120, photo: PS_MOOD_PHOTO.meditation })
    expect(g.kiirtan[0]).toMatchObject({ href: "/browse-shelf?id=theme%3Alonging", unit: "recordings", photo: KIIRTAN_MOOD_PHOTO.longing })
    for (const tile of [...g.songs, ...g.kiirtan]) expect(routeExists(stripQuery(tile.href)), tile.href).toBe(true)
  })
  it("a mood the photo table does not know gets no fixed photo (the photo system picks one)", () => {
    const g = moodGroups({ psMoods: [], kiirtanMoods: [{ id: "wild", label: "Wild", count: 3, href: "/browse-shelf?id=theme%3Awild" }] })
    expect(g.kiirtan[0].photo).toBeNull()
  })
  it("is empty, not invented, when the app holds no mood", () => {
    expect(moodGroups({ psMoods: [], kiirtanMoods: [] })).toEqual({ songs: [], kiirtan: [] })
  })
})

describe("Kiirtan type page", () => {
  it("lists the types that have recordings, biggest first, each opening its shelf", () => {
    const tiles = typeTiles({ bnk: 12, lila: 3, festival: 0, other: 5 }, (id) => id.toUpperCase())
    expect(tiles.map((t) => t.label)).toEqual(["BNK", "OTHER", "LILA"])
    expect(tiles[0]).toMatchObject({ href: "/browse-shelf?id=kiirtan%3Atype%3Abnk", count: 12, unit: "recordings", photo: TYPE_PHOTO.bnk })
    for (const tile of tiles) expect(routeExists(stripQuery(tile.href))).toBe(true)
  })
  it("is empty when no type has a recording", () => {
    expect(typeTiles({}, (id) => id)).toEqual([])
    expect(typeTiles(undefined, (id) => id)).toEqual([])
    expect(typeTiles({ bnk: 0 }, (id) => id)).toEqual([])
  })
})

describe("Festivals page", () => {
  const input = {
    coming: [{ id: "dipavali-2026", title: "Dipavali", line: "11 Nov · in 1 day" }],
    collections: [
      { id: "Dipavali Songs", label: "Dipavali", count: 14, href: "/songs-v2-collection?id=Dipavali", countLabel: "14 songs" },
      { id: "Empty Songs", label: "Empty", count: 0, href: "/songs-v2-collection?id=Empty", countLabel: "0 songs" },
    ],
    setCount: 4,
  }
  it("shows what is coming, the festival song lists and the event sets", () => {
    const s = festivalSections(input)
    expect(s.coming).toEqual([{ key: "coming:dipavali-2026", title: "Dipavali", line: "11 Nov · in 1 day", href: "/festival/dipavali-2026" }])
    expect(s.songs.map((r) => r.title)).toEqual(["Dipavali"])
    expect(s.sets).toEqual({ count: 4, href: "/browse-shelf?id=kiirtan%3Asets" })
    expect(festivalNames(s)).toEqual(["Dipavali", "Dipavali"])
    expect(routeExists("/festival/x")).toBe(true)
    expect(routeExists("/browse-shelf")).toBe(true)
  })
  it("is empty only when there is nothing at all, so the page can say so", () => {
    expect(festivalsEmpty(festivalSections({ coming: [], collections: [], setCount: 0 }))).toBe(true)
    expect(festivalsEmpty(festivalSections({ ...input, coming: [], collections: [] }))).toBe(false)
    expect(festivalsEmpty(festivalSections({ ...input, setCount: 0, collections: [] }))).toBe(false)
    expect(festivalSections({ coming: [], collections: [], setCount: 0 }).sets).toBeNull()
  })
})

describe("every route written in the new Search files exists", () => {
  const files = [
    "app/search-v2.tsx",
    "app/search-browse.tsx",
    "components/search-v2/SearchCards.tsx",
    "components/search-v2/NothingFound.tsx",
    "components/search-v2/BrowseTiles.tsx",
    "hooks/useSearchCardsData.ts",
  ]
  it("hrefs", () => {
    const routes = new Set<string>()
    for (const file of files) {
      const text = readFileSync(path.join(ROOT, file), "utf8")
      for (const match of text.matchAll(/href\(\s*([`"'])(\/[^`"']*)\1\s*\)/g)) routes.add(stripQuery(match[2].replace(/\$\{[^}]*\}/g, "x")))
    }
    for (const expected of ["/upload", "/collections-v2"]) expect([...routes], expected).toContain(expected)
    // "Ask us to add it" sends a guest to sign-in (written inside a ternary, so the regex above misses it)
    routes.add("/signin")
    routes.add("/feedback")
    routes.add("/search-browse")
    for (const route of routes) expect(routeExists(route), route).toBe(true)
  })
})
