import { describe, expect, it } from "vitest"

import { activeSourceKey, sourcePickedMessage, sourceRows, startNumber } from "@/lib/playerV2/sources"

describe("sourceRows", () => {
  it("lists All songs, Mine and the playlists with the prototype's meta lines", () => {
    const rows = sourceRows({
      catalogCount: 5018,
      savedCount: 3,
      playlists: [
        { id: "a", name: "Morning", count: 1 },
        { id: "b", name: "Kirtan", count: 12 },
      ],
    })
    expect(rows).toEqual([
      { key: "all", name: "All songs", meta: "5,018 songs" },
      { key: "mine", name: "Mine", meta: "3 saved" },
      { key: "pl:a", name: "Morning", meta: "1 song, playlist" },
      { key: "pl:b", name: "Kirtan", meta: "12 songs, playlist" },
    ])
  })
})

describe("activeSourceKey", () => {
  it("is all songs outside playlist mode", () => {
    expect(activeSourceKey("default", null)).toBe("all")
    expect(activeSourceKey("random", "x")).toBe("all")
  })
  it("maps playlist mode to the playlist or Mine", () => {
    expect(activeSourceKey("playlist", "abc")).toBe("pl:abc")
    expect(activeSourceKey("playlist", "mine")).toBe("mine")
    expect(activeSourceKey("playlist", null)).toBe("all")
  })
})

describe("sourcePickedMessage", () => {
  it("says what happened", () => {
    expect(sourcePickedMessage("Mine", 4)).toBe("Playing Mine")
    expect(sourcePickedMessage("Mine", 0)).toBe("Nothing in Mine yet")
  })
})

describe("startNumber", () => {
  const has = (n: number) => n !== 2
  it("keeps the current song when it is in the list and playable", () => {
    expect(startNumber([1, 2, 3], 3, has)).toBe(3)
  })
  it("otherwise starts at the first song with audio", () => {
    expect(startNumber([2, 3], 2, has)).toBe(3)
    expect(startNumber([2, 3], null, has)).toBe(3)
  })
  it("falls back to the first song, and to null for an empty list", () => {
    expect(startNumber([2], null, has)).toBe(2)
    expect(startNumber([], 1, has)).toBeNull()
  })
})
