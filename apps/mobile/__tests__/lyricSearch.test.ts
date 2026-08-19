import { describe, expect, it } from "vitest"

import { catalogLyricCount, searchLyrics, type LyricSearchRow } from "@/lib/lyricSearch"

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
})
