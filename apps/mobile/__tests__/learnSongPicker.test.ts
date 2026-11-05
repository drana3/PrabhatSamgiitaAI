import { describe, expect, it } from "vitest"

import { buildPickerIndex, entryFromIndexRow, parsePickerQuery, queryLabel, searchPicker } from "@/lib/learn/songPicker"

const ROWS = [
  { n: 1, t: "BANDHU HE NIYE CALO", o: "BANDHU HE NIYE CALO" },
  { n: 3, t: "ÁNDHÁRA SHEŚE ÁLORA DESHE", o: "ÁNDHÁRA SHEŚE ÁLORA DESHE" },
  { n: 10, t: "AMÁR GÁN", o: "Emon ek gán gáiba" },
  { n: 12, t: "TUMI ESECHILE", o: "Tumi esechile gáner pákhi" },
  { n: 100, t: "ALOR ALOR", o: "Alor alor kon pathe" },
  { n: 101, t: "SHITER SHEŚETE NAVA PÁTÁ ÁSE", o: "SHITER SHEŚETE NAVA PÁTÁ ÁSE" },
  { n: 1200, t: "BANDHU TUMI", o: "Bandhu tumi ke go" },
  { n: 4999, t: "LAST SONG", o: "Last song first line" },
]
const WITH_AUDIO = new Set([1, 10, 101])
const index = buildPickerIndex(ROWS.map((row) => entryFromIndexRow(row, (n) => WITH_AUDIO.has(n))))
const numbers = (raw: string, options?: { withAudio?: boolean }) => searchPicker(index, raw, options).map((e) => e.number)

describe("entries from the song index", () => {
  it("shows capitals as names and drops a first line that only repeats the title", () => {
    const first = index[0]!.entry
    expect(first.title).toBe("Bandhu He Niye Calo")
    expect(first.firstLine).toBeNull()
    expect(index[2]!.entry.firstLine).toBe("Emon ek gán gáiba")
  })
})

describe("what was typed", () => {
  it("reads numbers in the usual ways", () => {
    expect(parsePickerQuery("12")).toEqual({ kind: "number", digits: "12" })
    expect(parsePickerQuery("PS 12")).toEqual({ kind: "number", digits: "12" })
    expect(parsePickerQuery("ps-012")).toEqual({ kind: "number", digits: "12" })
    expect(parsePickerQuery("   ")).toEqual({ kind: "all" })
    expect(parsePickerQuery("bandhu he")).toEqual({ kind: "words", tokens: ["bandhu", "he"] })
  })

  it("tidies the typed words for the 'no match' line", () => {
    expect(queryLabel("  bandhu   he ")).toBe("bandhu he")
  })
})

describe("search", () => {
  it("lists every song in number order when nothing is typed", () => {
    expect(numbers("")).toEqual([1, 3, 10, 12, 100, 101, 1200, 4999])
  })

  it("a number puts that song first, then the songs whose number starts with it", () => {
    expect(numbers("10")).toEqual([10, 100, 101])
    expect(numbers("PS 1")).toEqual([1, 10, 12, 100, 101, 1200])
    expect(numbers("4999")).toEqual([4999])
    expect(numbers("5000")).toEqual([])
  })

  it("finds by title words, ignoring capitals and marks", () => {
    expect(numbers("ANDHARA shese")).toEqual([3])
    expect(numbers("shitar")).toEqual([])
    expect(numbers("shiter")).toEqual([101])
  })

  it("finds by words of the first line", () => {
    expect(numbers("pakhi")).toEqual([12])
    expect(numbers("emon ek")).toEqual([10])
  })

  it("needs every word, in any order", () => {
    expect(numbers("tumi bandhu")).toEqual([1200])
    expect(numbers("tumi nonsense")).toEqual([])
  })

  it("puts a title that starts with the words before one that only has them inside", () => {
    // PS 12 starts with "tumi"; PS 1200 has it as its second word
    expect(numbers("bandhu")).toEqual([1, 1200])
    expect(numbers("tumi")[0]).toBe(12)
  })

  it("'With audio' keeps songs that have a recording", () => {
    expect(numbers("", { withAudio: true })).toEqual([1, 10, 101])
    expect(numbers("10", { withAudio: true })).toEqual([10, 101])
  })

  it("a song whose audio is not known is never hidden by 'With audio'", () => {
    const unknown = buildPickerIndex([{ ...entryFromIndexRow(ROWS[0]!, () => true), hasAudio: null }])
    expect(searchPicker(unknown, "", { withAudio: true })).toHaveLength(1)
  })

  it("handles the whole catalogue size quickly", () => {
    const many = Array.from({ length: 5018 }, (_, i) => ({ n: i + 1, t: `SONG NUMBER ${i + 1}`, o: `Line ${i + 1}` }))
    const big = buildPickerIndex(many.map((row) => entryFromIndexRow(row, () => true)))
    const started = Date.now()
    expect(searchPicker(big, "song number 4", {}).length).toBeGreaterThan(1000)
    expect(searchPicker(big, "4017").map((e) => e.number)[0]).toBe(4017)
    expect(Date.now() - started).toBeLessThan(500)
  })
})
