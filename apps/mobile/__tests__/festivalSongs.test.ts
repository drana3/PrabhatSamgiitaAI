import { describe, expect, it } from "vitest"

import { allCollections } from "@/data/collections"
import { festivalCalendar } from "@/data/festivals"
import { FESTIVAL_LISTS, songsComposedOn, songsForFestival } from "@/data/festivalSongs"
import { daysUntilFestival, eveFestivals, festivalPhase, previewSongs } from "@/lib/festivalEve"

const festival = (id: string) => {
  const found = festivalCalendar.find((item) => item.id === id)
  if (!found) throw new Error(`no festival ${id}`)
  return found
}
const numbers = (list: { number: number }[]) => list.map((s) => s.number)

describe("festival to song links", () => {
  it("only name festivals that exist in the calendar, and collections that exist in the catalogue", () => {
    const bases = new Set(festivalCalendar.map((f) => f.id.replace(/-\d{4}$/, "")))
    for (const [base, link] of Object.entries(FESTIVAL_LISTS)) {
      expect(bases.has(base), base).toBe(true)
      for (const label of link.collections ?? []) {
        expect(allCollections.some((c) => c.label === label), label).toBe(true)
      }
    }
  })

  it("lists Diipavalii's own collection first, in the collection's order, then songs composed on 8 November", () => {
    const out = songsForFestival(festival("diipavalii-2026"))
    const own = allCollections.find((c) => c.label === "Dipavali (Colour Festival) Day Songs")!
    expect(numbers(out.listed)).toEqual(own.songNumbers)
    expect(out.listed.every((s) => s.basis === "list" && s.list === own.label)).toBe(true)
    expect(out.composed.length).toBeGreaterThan(0)
    expect(out.composed.every((s) => s.basis === "composed")).toBe(true)
    expect(numbers(out.all)).toEqual([...numbers(out.listed), ...numbers(out.composed)])
  })

  it("never repeats a song and never matches a composed song twice", () => {
    for (const f of festivalCalendar) {
      const all = numbers(songsForFestival(f).all)
      expect(new Set(all).size, f.id).toBe(all.length)
    }
  })

  it("keeps a festival's list when it moves to another year", () => {
    expect(numbers(songsForFestival(festival("diipavalii-2027")).listed)).toEqual(numbers(songsForFestival(festival("diipavalii-2026")).listed))
    expect(songsForFestival(festival("ananda-purnima-2027")).listed.length).toBeGreaterThan(0)
  })

  it("gives a festival with no list of its own only the songs composed on its day, never a guess", () => {
    const out = songsForFestival(festival("kaoshiki-2026"))
    expect(out.listed).toEqual([])
    expect(numbers(out.composed)).toEqual(songsComposedOn(9, 6).map(([n]) => n))
  })

  it("uses the reviewed mix for Prabháta Saḿgiita Divasa and does not repeat song 1 as composed on 14 September", () => {
    const out = songsForFestival(festival("ps-divasa-2026"))
    expect(numbers(out.listed)).toEqual([1, 68, 135, 647, 1418, 4281, 5018])
    expect(out.listed.every((s) => s.basis === "list" && s.list === null)).toBe(true)
    expect(numbers(out.composed)).not.toContain(1)
  })

  it("has no song for a day nobody composed on, and shows nothing for an unknown festival", () => {
    expect(songsForFestival({ id: "nope-2026", month: 2, day: 30 }).all).toEqual([])
  })
})

describe("composition dates table", () => {
  it("holds real calendar days, plausible song numbers and years, oldest first", () => {
    let total = 0
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= 31; day += 1) {
        const rows = songsComposedOn(month, day)
        if (rows.length) expect(new Date(2024, month - 1, day).getMonth() + 1, `${month}-${day}`).toBe(month)
        let lastYear = 0
        for (const [number, year] of rows) {
          total += 1
          expect(number).toBeGreaterThanOrEqual(1)
          expect(number).toBeLessThanOrEqual(5018)
          expect(year).toBeGreaterThanOrEqual(1900)
          expect(year).toBeLessThanOrEqual(2100)
          expect(year).toBeGreaterThanOrEqual(lastYear)
          lastYear = year
        }
      }
    }
    expect(total).toBeGreaterThan(4900)
  })

  it("knows song 1 was composed on 14 September 1982", () => {
    expect(songsComposedOn(9, 14).some(([n, y]) => n === 1 && y === 1982)).toBe(true)
  })
})

describe("the day before and the day of", () => {
  const at = (m: number, d: number, h = 0, min = 0) => new Date(2026, m - 1, d, h, min)

  it("counts local calendar days, so a festival is tomorrow from 00:05 on and not 24 hours earlier", () => {
    const f = festival("diipavalii-2026")
    expect(daysUntilFestival(at(11, 6, 23, 59), f)).toBe(2)
    expect(daysUntilFestival(at(11, 7, 0, 5), f)).toBe(1)
    expect(daysUntilFestival(at(11, 7, 23, 59), f)).toBe(1)
    expect(daysUntilFestival(at(11, 8, 0, 0), f)).toBe(0)
    expect(daysUntilFestival(at(11, 9, 0, 0), f)).toBe(-1)
  })

  it("names the phase only for today and tomorrow", () => {
    expect([-1, 0, 1, 2, 30].map(festivalPhase)).toEqual([null, "today", "tomorrow", null, null])
  })

  it("lists Diipavalii the day before and on its day, and not two days before or after", () => {
    const ids = (d: Date) => eveFestivals(d).map((f) => `${f.id}:${f.phase}`)
    expect(ids(at(11, 6, 12))).toEqual([])
    expect(ids(at(11, 7, 9))).toEqual(["diipavalii-2026:tomorrow"])
    expect(ids(at(11, 8, 9))).toEqual(["diipavalii-2026:today"])
    expect(ids(at(11, 9, 9))).toEqual([])
  })

  it("lists both days of two festivals in a row, today's first", () => {
    const out = eveFestivals(at(10, 16, 9)).map((f) => `${f.id}:${f.phase}`)
    expect(out).toEqual(["sharadotsava-2026:today", "public-day-2026:tomorrow"])
  })

  it("shows a short list of at most three rows, the festival's own songs first", () => {
    const out = songsForFestival(festival("diipavalii-2026"))
    const short = previewSongs(out)
    expect(short).toHaveLength(3)
    expect(short.every((s) => s.basis === "list")).toBe(true)
    expect(previewSongs(out, 0)).toEqual([])
  })
})
