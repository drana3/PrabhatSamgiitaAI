import { describe, expect, it } from "vitest"

import { coalesceSongDetail, localSongDetail, localTransposedNotation } from "@/lib/local-song-catalog"
import type { SongDetail } from "@/lib/api"

describe("localSongDetail", () => {
  it("loads lyrics and media from the packaged catalog without the API", () => {
    const song = localSongDetail(1)
    expect(song?.number).toBe(1)
    expect(song?.lyrics_original).toMatch(/BANDHU HE NIYE CALO/)
    expect(song?.media.some((item) => item.kind === "audio")).toBe(true)
    expect(song?.related_songs.length).toBeGreaterThan(0)
  })

  it("fills lyrics and meaning for other Roman sargam songs", () => {
    const song = localSongDetail(2)
    expect(song?.number).toBe(2)
    expect(song?.lyrics_original).toMatch(/GÁN|GAN/i)
    expect(song?.english_meaning).toBeTruthy()
    expect(localSongDetail(175)?.lyrics_original).toBeTruthy()
    expect(localSongDetail(176)).toBeNull()
    expect(localTransposedNotation(2)).toBeNull()
    expect(localTransposedNotation(5)).toBeNull()
    expect(localTransposedNotation(4961)).toBeNull()
    expect(localSongDetail(5)?.notation_transposition_available).toBe(false)
  })

  it("returns null for a number outside the catalog", () => {
    expect(localSongDetail(0)).toBeNull()
    expect(localSongDetail(99999)).toBeNull()
  })

  it("keeps booklet songs enabled unless the API explicitly hides notation", () => {
    const local = localSongDetail(1)
    expect(local?.notation_enabled).toBe(true)

    const remote = {
      ...(local as SongDetail),
      notation_enabled: false,
      notation_verification_status: "admin_submitted",
    }
    const merged = coalesceSongDetail(remote, local)
    expect(merged?.notation_enabled).toBe(false)
    expect(merged?.notation_transposition_available).toBe(false)
  })
})
