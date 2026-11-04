import { describe, expect, it } from "vitest"

import { plainText, sampleDuration, sampleSongs, searchSample } from "@/lib/fixtures/search"

describe("search sample data (prototype boards)", () => {
  it("has 64 songs with PS 1 to 7 first", () => {
    const songs = sampleSongs()
    expect(songs).toHaveLength(64)
    expect(songs.slice(0, 7).map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("'peaceful' gives 17 feeling matches, PS 2, 3, 7 first", () => {
    const hits = searchSample("peaceful")
    expect(hits).toHaveLength(17)
    expect(hits.slice(0, 3).map((h) => h.song.number)).toEqual([2, 3, 7])
    expect(hits.every((h) => h.why === "Feeling: peaceful")).toBe(true)
  })

  it("'bandhu' gives PS 1 and PS 6 by first line", () => {
    const hits = searchSample("bandhu")
    expect(hits.map((h) => [h.song.number, h.why])).toEqual([
      [1, "First line match"],
      [6, "First line match"],
    ])
  })

  it("a number matches by prefix, accents are ignored", () => {
    expect(searchSample("3")[0]).toMatchObject({ why: "Number match", song: { number: 3 } })
    expect(searchSample("andhara")[0].song.number).toBe(3)
    expect(plainText("Ándhára")).toBe("andhara")
  })

  it("a lyric word matches PS 1 and 3 only", () => {
    const hits = searchSample("darkness")
    expect(hits.map((h) => h.song.number)).toEqual([1, 3])
    expect(hits.every((h) => h.why === "Word match")).toBe(true)
  })

  it("empty query gives nothing", () => {
    expect(searchSample("  ")).toEqual([])
  })

  it("formats lengths", () => {
    expect(sampleDuration(271)).toBe("4:31")
    expect(sampleDuration(238)).toBe("3:58")
  })
})
