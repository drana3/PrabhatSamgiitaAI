import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/i18n", () => ({ t: (key: string) => key }))
// the photo files are images; the tests only need their metadata
vi.mock("@/lib/photos/assets", () => ({ PHOTO_ASSETS: new Proxy({}, { get: () => ({ cover: 1, thumb: 2 }) }) }))

import assignment from "@/data/psCollections/assignment.json"
import { PS_ALL, psSongNumbers } from "@/lib/psCollections/data"
import { isPsKey, MIN_SONGS, parsePsCollections, PS_SECTION_ORDER, songsForKey, visiblePs } from "@/lib/psCollections/parse"
import { collectionPhoto, seededPhoto, songPhoto } from "@/lib/psCollections/photo"
import { buildSections, filterSections, psHref, type SiteEntry } from "@/lib/psCollections/sections"
import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { ru } from "@/locales/ru"

/** The Prabhat Samgiita collections: data layer, what is shown, sections and photos (Dada, 11 Nov 2026). */

const ROOT = path.resolve(__dirname, "..")
const byId = <T extends { id: string }>(list: readonly T[], id: string): T | undefined => list.find((c) => c.id === id)

describe("the delivered main file", () => {
  const main = PS_ALL.filter((c) => c.source === "assignment")
  it("has the 24 collections with the codes unchanged, and every one of the 5018 songs", () => {
    expect(main.map((c) => c.id)).toEqual((assignment.collections as { id: string }[]).map((c) => c.id))
    expect(main.length).toBe(24)
    expect(new Set(main.flatMap((c) => c.songs)).size).toBe(5018)
  })
  it("shows path, society, memory and Sadhana after the 11 Nov read-through (118, 58, 55 and 57 songs)", () => {
    expect(byId(main, "inner-world")?.title).toBe("Sadhana")
    for (const [id, n] of [["path", 118], ["society", 58], ["memory", 55], ["inner-world", 57]] as const) {
      expect(byId(main, id)?.hidden, id).toBeNull()
      expect(byId(main, id)?.songs.length, id).toBe(n)
    }
    expect(visiblePs(main).length).toBe(24)
  })
  it("counts Songs of the heart honestly (518 songs without a theme, plus 97 dropped by the two read-throughs)", () => {
    expect(byId(main, "heart")?.songs.length).toBe(615)
    expect(byId(main, "heart")?.section).toBe("heart")
  })
})

describe("what the rules hide", () => {
  const file = (collections: unknown[]) => ({ status: "x", collections })
  const five = [1, 2, 3, 4, 5]
  it("reviewed:false hides, reviewed:true shows a pending one, no flag follows the default", () => {
    const list = parsePsCollections(
      "assignment",
      file([
        { id: "joy", title: "Joy", songs: five, reviewed: false },
        { id: "path", title: "Path", songs: five, reviewed: true },
        { id: "memory", title: "Memory", songs: five },
        { id: "light", title: "Light", songs: five },
      ]),
    )
    expect(list.map((c) => c.hidden)).toEqual(["review", null, "review", null])
  })
  it("hides a collection with fewer than five songs, but not one with exactly five", () => {
    expect(MIN_SONGS).toBe(5)
    const list = parsePsCollections("languages", file([{ id: "lang-a", title: "A", songs: [1, 2, 3, 4] }, { id: "lang-b", title: "B", songs: five }]))
    expect(list.map((c) => c.hidden)).toEqual(["small", null])
  })
  it("counts a song once, and ignores numbers that are not songs", () => {
    const [c] = parsePsCollections("tala", file([{ id: "tala-x", title: "X", songs: [3, 3, 4, "5", 0, -1, 2.5, 6, 7, 8, 9] }]))
    expect(c.songs).toEqual([3, 4, 6, 7, 8, 9])
  })
  it("never shows the unspecified collections nor the tala nobody could explain", () => {
    const big = Array.from({ length: 50 }, (_, i) => i + 1)
    const list = parsePsCollections("tala", file(["tala-unspecified", "tala-df", "tala-kf", "tala-baet", "raga-unspecified", "tala-d"].map((id) => ({ id, title: id, songs: big, reviewed: true }))))
    expect(list.map((c) => c.hidden)).toEqual(["unspecified", "unspecified", "unspecified", "unspecified", "unspecified", null])
  })
  it("survives a broken file", () => {
    expect(parsePsCollections("raga", null)).toEqual([])
    expect(parsePsCollections("raga", { collections: "no" })).toEqual([])
    expect(parsePsCollections("raga", file([null, { title: "no id" }, { id: "ok", songs: five }])).map((c) => c.id)).toEqual(["ok"])
  })
  it("takes a bare list as well as an object", () => {
    expect(parsePsCollections("languages", [{ id: "lang-x", title: "X", songs: five }]).length).toBe(1)
  })
})

describe("language, tala and raga files", () => {
  const visible = visiblePs(PS_ALL)
  it("shows Bengali (by default, not verified) like any collection, and the tala with real songs", () => {
    expect(visible.find((c) => c.id === "lang-bengali")?.section).toBe("language")
    expect(visible.find((c) => c.id === "tala-d")?.section).toBe("tala")
    expect(visible.find((c) => c.id === "tala-k")?.section).toBe("tala")
  })
  it("hides the single-song languages and the unexplained tala codes", () => {
    for (const id of ["lang-maithili", "lang-magahi", "lang-bhojpuri", "tala-df", "tala-kf", "tala-baet", "tala-unspecified", "raga-unspecified"]) {
      expect(visible.some((c) => c.id === id), id).toBe(false)
    }
  })
  it("has no Raga section while no raga reaches five songs, and gets it by itself once one does", () => {
    expect(visible.some((c) => c.section === "raga")).toBe(false)
    const more = parsePsCollections("raga", { collections: [{ id: "raga-yaman", title: "Yaman", songs: [1, 2, 3, 4, 5, 6] }] })
    const sections = buildSections({ ps: more, site: [], siteHref: () => "", titleOf: (id) => id, countLabel: String })
    expect(sections.map((s) => s.id)).toEqual(["raga"])
  })
})

describe("the sections of the page", () => {
  const site: SiteEntry[] = [
    { id: "morning", label: "Morning", kind: "mood", count: 92, countLabel: "92 songs" },
    { id: "Dipavali Songs", label: "Dipavali", kind: "festival", count: 14, countLabel: "14 songs" },
  ]
  const sections = buildSections({
    ps: PS_ALL,
    site,
    siteHref: (e) => `/songs-v2-collection?id=${e.id}`,
    titleOf: (id) => `T:${id}`,
    countLabel: (n) => `${n} songs`,
  })
  it("go feeling, time, season, theme, languages, tala, then From the site, and Songs of the heart last", () => {
    expect(sections.map((s) => s.id)).toEqual(["feeling", "time", "season", "theme", "language", "tala", "site", "heart"])
    expect(PS_SECTION_ORDER[PS_SECTION_ORDER.length - 1]).toBe("heart")
  })
  it("keeps the old Morning tile in From the site and puts the new Morning in Time of day (nothing removed)", () => {
    const time = sections.find((s) => s.id === "time")
    const old = sections.find((s) => s.id === "site")
    expect(time?.tiles.map((t) => t.label)).toEqual(["Morning", "Evening", "Night and Moon"])
    expect(old?.tiles.map((t) => t.label)).toEqual(["Morning", "Dipavali"])
    expect(time?.tiles[0].href).toBe(psHref("ps:assignment:morning", "Morning"))
    expect(old?.tiles[0].href).toBe("/songs-v2-collection?id=morning")
    expect(time?.tiles[0].key).not.toBe(old?.tiles[0].key)
  })
  it("Songs of the heart is one tile with the honest count", () => {
    const heart = sections[sections.length - 1]
    expect(heart.tiles.length).toBe(1)
    expect(heart.tiles[0]).toMatchObject({ label: "Songs of the Heart", count: 615, countLabel: "615 songs" })
  })
  it("shows the read collections in Theme, Sadhana among them, and no old Inner World name", () => {
    const theme = sections.find((s) => s.id === "theme")?.tiles.map((t) => t.label) ?? []
    for (const shown of ["The Path", "Society and Humanity", "Time and Memory", "Nature and Flowers", "Sadhana"]) expect(theme).toContain(shown)
    expect(theme).not.toContain("The Inner World")
  })
  it("a section with nothing to show is not there", () => {
    const only = buildSections({ ps: [], site: [], siteHref: () => "", titleOf: (id) => id, countLabel: String })
    expect(only).toEqual([])
  })
  it("search and section chips narrow the tiles; empty sections drop out", () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    const found = filterSections(sections, "morn", norm)
    expect(found.map((s) => s.id)).toEqual(["time", "site"])
    expect(filterSections(sections, "", norm, "heart").map((s) => s.id)).toEqual(["heart"])
    expect(filterSections(sections, "", norm, "site", "festival")[0].tiles.map((t) => t.label)).toEqual(["Dipavali"])
    expect(filterSections(sections, "zzzz", norm)).toEqual([])
  })
})

describe("route keys", () => {
  it("find the songs of the collection, and say nothing for a key that is not ours", () => {
    expect(isPsKey("ps:assignment:morning")).toBe(true)
    expect(isPsKey("morning")).toBe(false)
    expect(psSongNumbers("ps:assignment:morning")?.length).toBe(285)
    expect(psSongNumbers("ps:languages:lang-bengali")?.length).toBe(4933)
    expect(psSongNumbers("ps:assignment:nope")).toBeNull()
    expect(psSongNumbers("morning")).toBeNull()
    expect(songsForKey([], "ps:tala:tala-d")).toBeNull()
  })
  it("the page that opens it exists", () => {
    expect(existsSync(path.join(ROOT, "app/songs-v2-collection.tsx"))).toBe(true)
    expect(existsSync(path.join(ROOT, "app/collections-v2.tsx"))).toBe(true)
  })
})

describe("photos instead of letters", () => {
  it("the same collection or song always gets the same photo, and it never shows a person or Baba", () => {
    for (const seed of ["ps:assignment:morning", "ps:assignment:heart", "site:morning", "ps:tala:tala-d"]) {
      const photo = collectionPhoto(seed)
      expect(collectionPhoto(seed)).toBe(photo)
      expect(photo.people).toBe("none")
      expect(photo.subject).not.toBe("baba")
    }
    for (const n of [1, 42, 5018]) {
      expect(songPhoto(n)).toBe(songPhoto(n))
      expect(songPhoto(n).people).toBe("none")
    }
  })
  it("different songs do not all get one picture", () => {
    expect(new Set(Array.from({ length: 60 }, (_, i) => songPhoto(i + 1).n)).size).toBeGreaterThan(5)
  })
  it("a morning mood stays a warm morning picture, still without people", () => {
    expect(seededPhoto("x", "morning").people).toBe("none")
  })
  it("the screens no longer draw a letter for a collection", () => {
    const page = readFileSync(path.join(ROOT, "components/songs-v2/ListPage.tsx"), "utf8")
    expect(page).not.toContain("AccentCover")
    expect(page).toContain("PhotoCover")
  })
})

describe("words in three languages", () => {
  const keys = [
    ...PS_SECTION_ORDER.map((id) => `psColl.section.${id}`),
    "psColl.section.site",
    "psColl.chips.all",
    "songs.coll.plusHint",
  ]
  it("every section name and the plus hint exist in en, ru and es", () => {
    for (const dict of [en, ru, es] as Record<string, string>[]) for (const key of keys) expect(dict[key], key).toBeTruthy()
    expect(en["psColl.section.language"]).toBe("Languages")
    expect(en["psColl.section.tala"]).toBe("Tala")
    expect(en["psColl.section.site"]).toBe("From the site")
    expect(en["psColl.section.heart"]).toBe("Songs of the heart")
  })
})

describe("the sync script", () => {
  it("maps the four source files onto the four files the app reads", () => {
    const script = readFileSync(path.join(ROOT, "scripts/syncPsCollections.mjs"), "utf8")
    for (const [from, to] of [["collections-assignment.json", "assignment.json"], ["collections-languages.json", "languages.json"], ["collections-tala.json", "tala.json"], ["collections-raga.json", "raga.json"]]) {
      expect(script).toContain(`"${from}": "${to}"`)
      expect(existsSync(path.join(ROOT, "data/psCollections", to)), to).toBe(true)
    }
  })
})
