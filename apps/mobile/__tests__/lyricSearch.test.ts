import { describe, expect, it } from "vitest"

import {
  catalogLyricCount,
  catalogSongByNumber,
  catalogSongsByNumbers,
  searchCatalogLyrics,
  searchLyrics,
  type LyricSearchRow,
} from "@/lib/lyricSearch"

const rows: LyricSearchRow[] = [
  {
    n: 1,
    t: "BANDHU HE NIYE CALO",
    o: "BANDHU HE NIYE CALO",
    b: "bandhu he niye calo alor oi jharana dharara pane andharer vyatha ar saye na prane",
  },
  {
    n: 2,
    t: "E GAN AMAR",
    o: "E GAN AMAR ALOR JHARANA DHARA",
    b: "e gan amar alor jharana dhara tomar katha",
  },
]

describe("lyric search", () => {
  it("ranks an opening line first", () => {
    const hits = searchLyrics("BANDHU HE NIYE CALO", rows)
    expect(hits[0]?.number).toBe(1)
    expect(hits[0]?.matchedBy).toBe("opening_line")
  })

  it("finds a line from inside the song", () => {
    const hits = searchLyrics("andharer vyatha ar saye na prane", rows)
    expect(hits.map((hit) => hit.number)).toContain(1)
  })

  it("returns at most five songs", () => {
    const extra = Array.from({ length: 8 }, (_, index) => ({
      n: index + 10,
      t: "peace song",
      o: "peace song",
      b: "peace in the heart peace in the mind",
    }))
    expect(searchLyrics("peace", [...rows, ...extra])).toHaveLength(5)
  })

  it("indexes all 5018 songs", () => {
    expect(catalogLyricCount()).toBe(5018)
  })

  it("looks up many saved songs past the default search limit of 5", () => {
    const hits = catalogSongsByNumbers([1, 2, 3, 4, 5, 6, 5018], 7)
    expect(hits.map((hit) => hit.number)).toEqual([1, 2, 3, 4, 5, 6, 5018])
  })

  it("resolves catalog numbers from the bundled index (Explore must use this, not lyric text)", () => {
    expect(catalogSongByNumber("1")?.number).toBe(1)
    expect(catalogSongByNumber("9")?.number).toBe(9)
    expect(catalogSongByNumber("2000")?.number).toBe(2000)
    expect(catalogSongByNumber("ps 2000")?.number).toBe(2000)
    expect(catalogSongByNumber("9999")).toBeNull()
  })

  it("finds opening words without waiting on a full token index", () => {
    const started = Date.now()
    const hits = searchCatalogLyrics("bandhu", 5, { interpret: true })
    expect(Date.now() - started).toBeLessThan(120)
    expect(hits[0]?.number).toBe(1)
  })
})
