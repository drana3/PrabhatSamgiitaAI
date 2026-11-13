import { describe, expect, it } from "vitest"

import { allCollections } from "@/data/collections"
import { PS_ALL } from "@/lib/psCollections/data"
import { pairLine, pairsOfChart, softCaseLine } from "@/lib/psColleagues/chordPairs"
import { colleagueChartsOf } from "@/lib/psColleagues/chords"
import { loadColleagueChords, loadColleagueDates } from "@/lib/psColleagues/load"
import { collectionsOfSong, colleagueDateRow, dayOfDateLine, sayMoreThanDate } from "@/lib/songPage/infoFacts"
import { infoChordsEn, infoChordsEs, infoChordsRu } from "@/locales/infoChords"

describe("colleague chord pages as chord letters over words", () => {
  it("puts a chord over the word whose columns hold it, and keeps every word and chord", () => {
    const tokens = pairLine("  D        A", "BANDHU HE NIYE CALO")
    expect(tokens.map((t) => t.word)).toEqual(["BANDHU", "HE", "NIYE", "CALO"])
    expect(tokens.map((t) => t.chord)).toEqual(["D", "", "A", ""])
  })

  it("a chord between two words goes to the nearer one (the later on a tie), several chords on one word are written together", () => {
    expect(pairLine("   G", "AB    CD").map((t) => t.chord)).toEqual(["G", ""]) // column 3 is nearer to AB's end (1)? 2 away vs 3 away
    expect(pairLine("A        B", "ab cd").map((t) => t.chord)).toEqual(["A", "B"])
    expect(pairLine("G D", "WORD").map((t) => t.chord)).toEqual(["G D"])
  })

  it("marks a wide gap in the words line as where the next lyric line starts", () => {
    const tokens = pairLine("", "ONE TWO   THREE FOUR")
    expect(tokens.map((t) => !!t.breakBefore)).toEqual([false, false, true, false])
  })

  it("a chord line with no words under it is a row of chords alone; an empty line makes a gap", () => {
    const rows = pairsOfChart({ lines: ["A B", "", "C", "word"], chordLines: [0, 2] })
    expect(rows[0]).toEqual({ tokens: [{ chord: "A", word: "" }, { chord: "B", word: "" }], gapBefore: false })
    expect(rows[1].gapBefore).toBe(true)
    expect(rows[1].tokens).toEqual([{ chord: "C", word: "word" }])
  })

  it("loses no word and no chord symbol on any of the 73 chord pages of the documents", async () => {
    const wire = await loadColleagueChords()
    let pages = 0
    for (const number of Object.keys(wire.docx)) {
      const chart = colleagueChartsOf(wire, Number(number))[0]
      if (!chart || chart.source.kind !== "docx") continue
      pages += 1
      const rows = pairsOfChart(chart)
      const words = rows.flatMap((r) => r.tokens.map((t) => t.word)).filter(Boolean)
      const chords = rows.flatMap((r) => r.tokens.flatMap((t) => t.chord.split(" "))).filter(Boolean)
      const chordSet = new Set(chart.chordLines)
      const expectWords = chart.lines.filter((_, i) => !chordSet.has(i)).flatMap((l) => l.trim().split(/\s+/)).filter(Boolean)
      const expectChords = chart.chordLines.flatMap((i) => (chart.lines[i] as string).trim().split(/\s+/)).filter(Boolean)
      expect(words, `words of song ${number}`).toEqual(expectWords)
      expect(chords.slice().sort(), `chords of song ${number}`).toEqual(expectChords.slice().sort())
    }
    expect(pages).toBe(73)
  })

  it("writes a line set in capitals as sentence case, leaves the x2 marks, and leaves lines that already have lower case", () => {
    expect(softCaseLine("BANDHU HE NIYE CALO  x2    ÁLOR OI")).toBe("Bandhu he niye calo  x2    álor oi")
    expect(softCaseLine("Tomár kole")).toBe("Tomár kole")
    expect(softCaseLine("ÁṊDHÁRER VYATHÁ").length).toBe("ÁṊDHÁRER VYATHÁ".length)
  })
})

describe("Info: collections and the colleagues' date line", () => {
  it("lists the collections that hold a song, each name once", () => {
    const list = collectionsOfSong(1, PS_ALL, allCollections)
    expect(list.length).toBeGreaterThan(0)
    const names = list.map((c) => c.label.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
    for (const c of list) expect(c.href.startsWith("/songs-v2-collection?id=")).toBe(true)
  })

  it("returns nothing for a number no collection holds", () => {
    expect(collectionsOfSong(99999999, PS_ALL, allCollections)).toEqual([])
  })

  it("reads a date line in the four languages of the documents", () => {
    expect(dayOfDateLine("September 14, 1982", "en")).toEqual({ year: 1982, month: 9, day: 14 })
    expect(dayOfDateLine("14 Septembre, 1982", "fr")).toEqual({ year: 1982, month: 9, day: 14 })
    expect(dayOfDateLine("14 сентября 1982 г.", "ru")).toEqual({ year: 1982, month: 9, day: 14 })
    expect(dayOfDateLine("14 вересня 1982 р.", "uk")).toEqual({ year: 1982, month: 9, day: 14 })
    expect(dayOfDateLine("sometime in 1982", "en")).toBeNull()
  })

  it("knows a bare date from a line that names a place or says more", () => {
    expect(sayMoreThanDate("September 14, 1982")).toBe(false)
    expect(sayMoreThanDate("14 сентября 1982 г.")).toBe(false)
    expect(sayMoreThanDate("6 серпня 1986 року")).toBe(false)
    expect(sayMoreThanDate("March 2, 1984, Jammu")).toBe(true)
    expect(sayMoreThanDate("March 20, 1984, on the road from Kota to Gwalior")).toBe(true)
  })

  it("shows the colleagues' line when it names a place, when the official date is missing, or when the day differs; not when it only repeats the date", () => {
    const official = { year: 1984, month: 3, day: 2 }
    expect(colleagueDateRow({ en: "March 2, 1984, Jammu" }, "en", official)?.text).toBe("March 2, 1984, Jammu")
    expect(colleagueDateRow({ en: "March 2, 1984" }, "en", official)).toBeNull()
    expect(colleagueDateRow({ en: "March 3, 1984" }, "en", official)?.text).toBe("March 3, 1984")
    expect(colleagueDateRow({ en: "March 2, 1984" }, "en", null)?.text).toBe("March 2, 1984")
    expect(colleagueDateRow({}, "en", null)).toBeNull()
  })

  it("prefers the app language, then English", () => {
    const lines = { en: "March 2, 1984, Jammu", ru: "2 марта 1984 г., Джамму" }
    expect(colleagueDateRow(lines, "ru", null)?.lang).toBe("ru")
    expect(colleagueDateRow(lines, "es", null)?.lang).toBe("en")
  })

  it("has the date line of the songs whose documents name a place", async () => {
    const dates = await loadColleagueDates()
    expect(dates["1316"]?.en).toBe("March 2, 1984, Jammu")
    expect(dates["1854"]?.ru).toContain("Калькутта")
  })
})

describe("strings", () => {
  it("ru and es have every key of en", () => {
    for (const key of Object.keys(infoChordsEn)) {
      expect(infoChordsRu[key], key).toBeTruthy()
      expect((infoChordsEs as Record<string, string>)[key], key).toBeTruthy()
    }
  })
})
