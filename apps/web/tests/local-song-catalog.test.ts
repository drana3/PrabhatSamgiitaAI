import { describe, expect, it } from "vitest"

import { alignDevanagariStanzaGaps } from "@prabhat/core"

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
    expect(song?.lyrics_original).toMatch(/GÁN|GAN/i)
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

  it("strips Sanskrit label lyrics from API when coalescing (PS 1565)", () => {
    const base = localSongDetail(1) as SongDetail
    const remote: SongDetail = {
      ...base,
      number: 1565,
      title: "SAḾSKRTA",
      first_line: "SAḾSKRTA",
      language: "Sanskrit",
      lyrics_original: "SAḾSKRTA\nVAJRA KAT́HORA KUSUMA KORAKA\nPINÁKA PÁŃAYE NAMO NAMASTE",
    }
    const local: SongDetail = {
      ...remote,
      lyrics_original: remote.lyrics_original,
    }
    const merged = coalesceSongDetail(remote, local)
    expect(merged?.title).toMatch(/VAJRA/i)
    expect(merged?.first_line).toMatch(/VAJRA/i)
    expect(merged?.lyrics_original).toMatch(/^VAJRA/i)
    expect(merged?.lyrics_original).not.toMatch(/SAḾSKRTA|SAMSKRTA/i)
  })

  it("mirrors Roman stanza gaps when coalescing Devanagari from API + seed", () => {
    const local = localSongDetail(5) as SongDetail
    const flatDev = (local.lyrics_devanagari ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n")
    const remote: SongDetail = {
      ...local,
      lyrics_devanagari: flatDev,
      devanagari_status: "provisional",
    }
    const merged = coalesceSongDetail(remote, local)
    expect(merged?.lyrics_original).toBeTruthy()
    expect(merged?.lyrics_devanagari).toBe(
      alignDevanagariStanzaGaps(merged!.lyrics_original!, flatDev),
    )
    expect((merged?.lyrics_devanagari ?? "").split("\n").some((line) => !line.trim())).toBe(true)
  })

  it("prefers approved API Devanagari over packaged seed text", () => {
    const local = localSongDetail(1) as SongDetail
    const remote = {
      ...local,
      lyrics_devanagari: "सम्पादित देवनागरी",
      devanagari_status: "approved",
    }
    const merged = coalesceSongDetail(remote, {
      ...local,
      lyrics_devanagari: "पुराना कैटलॉग पाठ",
      devanagari_status: "provisional",
    })
    expect(merged?.lyrics_devanagari).toBe("सम्पादित देवनागरी")
    expect(merged?.devanagari_status).toBe("approved")
  })
})
