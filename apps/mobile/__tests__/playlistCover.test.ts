import { describe, expect, it } from "vitest"

import {
  COVER_GRID_SIZE,
  cleanPlaylistName,
  coverChoices,
  coverPool,
  defaultCoverFor,
  defaultPlaylistName,
  isCoverPhoto,
  randomCover,
  resolveCover,
} from "@/lib/playlists/playlistCover"
import { STOCK_PHOTO_META } from "@/lib/photos/photoData"

describe("playlist cover photo", () => {
  it("draws only from photos with nobody in the picture", () => {
    const pool = coverPool()
    expect(pool.length).toBeGreaterThanOrEqual(COVER_GRID_SIZE)
    for (const p of pool) {
      expect(STOCK_PHOTO_META.find((m) => m.n === p.n)?.people).toBe("none")
    }
  })

  it("derives the same photo for the same playlist id, every time", () => {
    const a = defaultCoverFor("pl-123")
    for (let i = 0; i < 5; i++) expect(defaultCoverFor("pl-123")).toBe(a)
    expect(isCoverPhoto(a)).toBe(true)
  })

  it("spreads different ids over several photos", () => {
    const seen = new Set(Array.from({ length: 40 }, (_, i) => defaultCoverFor(`pl-${i}`)))
    expect(seen.size).toBeGreaterThan(5)
  })

  it("resolves a stored choice, and falls back to the derived one when it is missing or no longer valid", () => {
    const chosen = coverPool()[3].n
    expect(resolveCover("x", chosen)).toBe(chosen)
    expect(resolveCover("x", undefined)).toBe(defaultCoverFor("x"))
    expect(resolveCover("x", null)).toBe(defaultCoverFor("x"))
    expect(resolveCover("x", -5)).toBe(defaultCoverFor("x"))
  })

  it("picks randomly with an injected rng, never the photo to avoid, always inside the pool", () => {
    const pool = coverPool()
    expect(randomCover(() => 0)).toBe(pool[0].n)
    expect(randomCover(() => 0.999999)).toBe(pool[pool.length - 1].n)
    expect(randomCover(() => 0, pool[0].n)).toBe(pool[1].n)
    for (let i = 0; i < 50; i++) expect(isCoverPhoto(randomCover(Math.random))).toBe(true)
  })

  it("offers a grid of 12 with the current photo first, the same on every call", () => {
    const current = coverPool()[7].n
    const grid = coverChoices(current, 0)
    expect(grid).toHaveLength(COVER_GRID_SIZE)
    expect(grid[0]).toBe(current)
    expect(new Set(grid).size).toBe(COVER_GRID_SIZE)
    expect(coverChoices(current, 0)).toEqual(grid)
  })

  it("Shuffle another gives a different set", () => {
    const current = coverPool()[0].n
    const first = coverChoices(current, 0)
    const second = coverChoices(current, 1)
    expect(second[0]).toBe(current)
    expect(second.slice(1)).not.toEqual(first.slice(1))
  })
})

describe("default playlist name", () => {
  it("counts from the number of playlists + 1", () => {
    expect(defaultPlaylistName([])).toBe("Playlist 1")
    expect(defaultPlaylistName([{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }])).toBe("Playlist 5")
  })
  it("skips a name that is taken, in any letter case", () => {
    expect(defaultPlaylistName([{ name: "Playlist 2" }, { name: "x" }])).toBe("Playlist 3")
    expect(defaultPlaylistName([{ name: "playlist 3" }, { name: "Playlist 4" }, { name: "x" }])).toBe("Playlist 5")
  })
  it("uses the language of the screen", () => {
    expect(defaultPlaylistName([{ name: "а" }], (n) => `Плейлист ${n}`)).toBe("Плейлист 2")
  })
})

describe("cleanPlaylistName", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanPlaylistName("  Morning   kiirtan ")).toBe("Morning kiirtan")
  })
  it("refuses an empty name", () => {
    expect(cleanPlaylistName("   ")).toBeNull()
    expect(cleanPlaylistName("")).toBeNull()
  })
  it("cuts at 120 characters", () => {
    expect(cleanPlaylistName("a".repeat(200))).toHaveLength(120)
  })
})
