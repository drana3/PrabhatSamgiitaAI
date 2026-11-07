import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { MIXED_SONGS, SANSKRIT_SONGS } from "@/data/pronunciation/songLanguages"
import { languageFromText, songPronLanguage } from "@/lib/pronunciation/songLanguage"

type CatalogueSong = { number: number; lyrics_original: string | null }
const catalogue: CatalogueSong[] = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../data/generated/songs.json"), "utf8"))
const lyrics = (n: number) => catalogue.find((row) => row.number === n)?.lyrics_original ?? ""

describe("which memo a song gets", () => {
  it("gives the Sanskrit songs of the catalogue the Sanskrit memo", () => {
    for (const n of [1565, 2526, 3653, 4279, 4281, 3246]) expect(songPronLanguage(n, lyrics(n)), `PS ${n}`).toBe("sanskrit")
  })

  it("gives the songs with a Sanskrit verse and Bengali verses both memos", () => {
    for (const n of [4601, 4602, 4607, 4636]) expect(songPronLanguage(n, lyrics(n)), `PS ${n}`).toBe("both")
  })

  it("gives Bengali songs the Bengali memo", () => {
    for (const n of [1, 2, 3, 15, 25, 283, 4360]) expect(songPronLanguage(n, lyrics(n)), `PS ${n}`).toBe("bengali")
  })

  it("keeps the hand-checked lists real: every number is a song of the catalogue", () => {
    for (const n of [...SANSKRIT_SONGS, ...MIXED_SONGS]) expect(catalogue.some((row) => row.number === n), `PS ${n}`).toBe(true)
  })

  it("is Bengali for a missing or empty text and for a song with no number", () => {
    expect(songPronLanguage(null, "")).toBe("bengali")
    expect(songPronLanguage(undefined, "")).toBe("bengali")
    expect(languageFromText("")).toBe("bengali")
  })

  it("keeps the whole catalogue honest: a handful of Sanskrit songs, the rest Bengali", () => {
    const counts = { bengali: 0, sanskrit: 0, both: 0 }
    for (const row of catalogue) counts[songPronLanguage(row.number, row.lyrics_original ?? "")]++
    expect(counts.both).toBe(MIXED_SONGS.length)
    expect(counts.sanskrit).toBeGreaterThanOrEqual(6)
    expect(counts.sanskrit).toBeLessThanOrEqual(12)
    expect(counts.bengali).toBeGreaterThan(5000 - 30)
  })
})
