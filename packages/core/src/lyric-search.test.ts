import { describe, expect, it } from "vitest"

import { isLyricCatalogQuery, searchLyrics, type LyricSearchRow } from "./lyric-search"

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
    expect(hits[0]?.snippet).toMatch(/BANDHU HE NIYE CALO/i)
  })

  it("treats verse fragments as lyric catalog queries", () => {
    expect(isLyricCatalogQuery("bandhu he niye calo")).toBe(true)
    expect(
      isLyricCatalogQuery("alor oi jharana dharara pane andharer vyatha ar saye na prane"),
    ).toBe(true)
    expect(isLyricCatalogQuery("songs about peace")).toBe(false)
    expect(isLyricCatalogQuery("1")).toBe(false)
  })

  it("finds a line from inside the song", () => {
    const hits = searchLyrics("andharer vyatha ar saye na prane", rows)
    expect(hits.map((hit) => hit.number)).toContain(1)
    expect(hits[0]?.snippet.toLowerCase()).toContain("andharer vyatha")
  })

  it("does not treat English meaning translations as lyrics", () => {
    const hits = searchLyrics("i can no longer bear the pain of darkness in my heart", rows)
    expect(hits.map((hit) => hit.number)).not.toContain(1)
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
})
