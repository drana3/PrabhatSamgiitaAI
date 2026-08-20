import { describe, expect, it } from "vitest"

import { localSongDetail } from "@/lib/local-song-catalog"

describe("localSongDetail", () => {
  it("loads lyrics and media from the packaged catalog without the API", () => {
    const song = localSongDetail(1)
    expect(song?.number).toBe(1)
    expect(song?.lyrics_original).toMatch(/BANDHU HE NIYE CALO/)
    expect(song?.media.some((item) => item.kind === "audio")).toBe(true)
    expect(song?.related_songs.length).toBeGreaterThan(0)
  })

  it("returns null for a number outside the catalog", () => {
    expect(localSongDetail(0)).toBeNull()
    expect(localSongDetail(99999)).toBeNull()
  })
})
