import { describe, expect, it } from "vitest"

import { sequentialSongOfTheDay } from "./song-of-the-day"

describe("sequential song of the day", () => {
  it("maps the epoch to PS 1 and wraps after PS 5018", () => {
    expect(sequentialSongOfTheDay(1970, 1, 1)).toBe(1)
    expect(sequentialSongOfTheDay(1970, 1, 2)).toBe(2)
    const start = Date.UTC(1970, 0, 1)
    const day5018 = new Date(start + 5017 * 86_400_000)
    const day5019 = new Date(start + 5018 * 86_400_000)
    expect(sequentialSongOfTheDay(day5018.getUTCFullYear(), day5018.getUTCMonth() + 1, day5018.getUTCDate())).toBe(5018)
    expect(sequentialSongOfTheDay(day5019.getUTCFullYear(), day5019.getUTCMonth() + 1, day5019.getUTCDate())).toBe(1)
  })

  it("is the same for every caller on one civil date", () => {
    expect(sequentialSongOfTheDay(2026, 10, 21)).toBe(sequentialSongOfTheDay(2026, 10, 21))
    expect(sequentialSongOfTheDay(2026, 10, 22)).toBe(sequentialSongOfTheDay(2026, 10, 21) + 1)
  })
})
