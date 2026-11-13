import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
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

import { SEARCH_DISCOVER, SEARCH_TOP_TILES } from "@/lib/fixtures/home"
import { NAV_V2_HOME_ROUTE, NAV_V2_TABS } from "@/lib/navV2"
import { BROWSE_KIND_ORDER, browseKindTiles, kindTarget, realCollectionEntries } from "@/lib/searchBrowse"
import { KIND_ORDER, kindLabel, type CollectionKind } from "@/lib/songsV2/collectionsIndex"
import { songNumbersForCategory } from "@/lib/categorySongs"
import { searchLocal } from "@/lib/unifiedSearch"

/**
 * Every control of the Search page leads to a page that exists, and the "Browse all" list is made of
 * what the app really has. See docs/search-scenarios.md for the inventory.
 */

const ROOT = path.resolve(__dirname, "..")
const APP = path.join(ROOT, "app")

/** True when `route` (no query) is a file of the expo-router tree: app/a/b.tsx or app/a/b/index.tsx, with [param] and (group) folders. */
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
      // a (group) folder is invisible in the URL
      if (isDir && /^\(.+\)$/.test(name) && walk(full, rest)) return true
    }
    return false
  }
  return walk(APP, parts)
}

const stripQuery = (target: string) => target.split("?")[0]

/** Routes written as href("...") or href(`...`) in the files that make up the Search page. */
function hrefLiterals(file: string): string[] {
  const text = readFileSync(path.join(ROOT, file), "utf8")
  const found: string[] = []
  for (const match of text.matchAll(/href\(\s*([`"'])(\/[^`"']*)\1\s*\)/g)) found.push(match[2].replace(/\$\{[^}]*\}/g, "x"))
  return found
}

const SEARCH_FILES = [
  "app/search-v2.tsx",
  "app/search-browse.tsx",
  "components/search-v2/BrowseBlocks.tsx",
  "components/search-v2/SearchCards.tsx",
  "components/search-v2/NothingFound.tsx",
  "components/search-v2/SearchBlocks.tsx",
  "components/search-v2/StoryResults.tsx",
  "hooks/useKirtanActions.ts",
]

describe("routeExists (the checker itself)", () => {
  it("finds real routes and rejects invented ones", () => {
    expect(routeExists("/stories")).toBe(true)
    expect(routeExists("/stories/some-slug")).toBe(true)
    expect(routeExists("/song-v2/abc")).toBe(true)
    expect(routeExists("/v2/learn")).toBe(true)
    expect(routeExists("/collections-v2")).toBe(true)
    expect(routeExists("/ragas")).toBe(false)
    expect(routeExists("/search-v2/instruments")).toBe(false)
  })
})

describe("every Search control opens a page that exists", () => {
  it("top tiles", () => {
    expect(SEARCH_TOP_TILES.length).toBeGreaterThan(0)
    for (const tile of SEARCH_TOP_TILES) expect(routeExists(stripQuery(tile.target)), `${tile.id} -> ${tile.target}`).toBe(true)
  })

  it("Browse all tiles", () => {
    const tiles = browseKindTiles(realCollectionEntries(), (kind) => kind)
    expect(tiles.length).toBeGreaterThan(0)
    for (const tile of tiles) expect(routeExists(stripQuery(tile.target)), `${tile.id} -> ${tile.target}`).toBe(true)
  })

  it("every route written in the Search files", () => {
    const routes = new Set(SEARCH_FILES.flatMap(hrefLiterals))
    // the scan sees the routes it should (a changed pattern must not make this test pass on nothing)
    for (const expected of ["/song-v2/x", "/stories/x", "/stories", "/assistant", "/profile-sheet", "/collections-v2", "/kirtan-artist"]) {
      expect([...routes].some((route) => stripQuery(route) === expected), expected).toBe(true)
    }
    for (const route of routes) expect(routeExists(stripQuery(route)), route).toBe(true)
  })

  it("the page Search goes back to when it was opened by a link", () => {
    expect(routeExists(NAV_V2_HOME_ROUTE)).toBe(true)
    for (const tab of NAV_V2_TABS) expect(routeExists(stripQuery(tab.href)), `${tab.id} -> ${tab.href}`).toBe(true)
  })
})

describe("Browse all is made of what the app has", () => {
  const entries = realCollectionEntries()
  const tiles = browseKindTiles(entries, (kind) => kindLabel(kind, true))

  it("has one tile per kind of collection that exists, and no other", () => {
    expect(tiles.map((tile) => tile.kind)).toEqual(BROWSE_KIND_ORDER.filter((kind) => entries.some((entry) => entry.kind === kind)))
    // every kind the All collections page knows is reachable from Search
    for (const kind of KIND_ORDER) expect(tiles.some((tile) => tile.kind === kind), kind).toBe(true)
  })

  it("never shows a tile for an empty kind", () => {
    expect(browseKindTiles([], (kind) => kind)).toEqual([])
    const onlyFestivals = entries.filter((entry) => entry.kind === "festival")
    expect(browseKindTiles(onlyFestivals, (kind) => kind).map((tile) => tile.kind)).toEqual(["festival"])
  })

  it("counts the collections of each kind and opens the All collections page on that kind", () => {
    for (const tile of tiles) {
      expect(tile.count).toBe(entries.filter((entry) => entry.kind === tile.kind).length)
      expect(tile.count).toBeGreaterThan(0)
      expect(tile.target).toBe(kindTarget(tile.kind))
      expect((KIND_ORDER as readonly string[]).includes(new URL(`http://x${tile.target}`).searchParams.get("kind") ?? "")).toBe(true)
    }
  })

  it("every collection on those pages has songs behind it", () => {
    for (const entry of entries) {
      expect(entry.count, entry.label).toBeGreaterThan(0)
      expect(songNumbersForCategory(entry.id).length, entry.label).toBeGreaterThan(0)
    }
  })

  it("keeps neighbouring tiles (side by side and above) in different tones", () => {
    tiles.forEach((tile, i) => {
      if (i % 2 === 0 && tiles[i + 1]) expect(tiles[i + 1].tone).not.toBe(tile.tone)
      if (tiles[i + 2]) expect(tiles[i + 2].tone).not.toBe(tile.tone)
    })
  })

  it("has no tile for what the catalogue does not hold (ragas, instruments, plays, new, made for you)", () => {
    const labels = tiles.map((tile) => `${tile.id} ${tile.label}`.toLowerCase()).join(" ")
    for (const word of ["raga", "instrument", "played", "new", "made"]) expect(labels).not.toContain(word)
    // the reason, from the data itself: the fields behind those tiles are empty in all 5,018 songs
    const songs = JSON.parse(readFileSync(path.resolve(ROOT, "../../data/generated/songs.json"), "utf8")) as Array<Record<string, unknown>>
    expect(songs.length).toBe(5018)
    for (const field of ["raga", "tala", "mood", "difficulty", "meditation_context"]) {
      expect(songs.filter((song) => song[field]).length, `songs with ${field}`).toBe(0)
    }
  })

  it("moods are the six lists of the Songs shelf", () => {
    const moods = entries.filter((entry) => entry.kind === ("mood" satisfies CollectionKind))
    expect(moods).toHaveLength(6)
  })
})

describe("Discover tags", () => {
  it("each one searches a real feeling or word and finds songs", () => {
    expect(SEARCH_DISCOVER.length).toBeGreaterThan(0)
    for (const tag of SEARCH_DISCOVER) {
      const result = searchLocal(tag.query)
      expect(result.total, tag.query).toBeGreaterThan(0)
    }
  })
})
