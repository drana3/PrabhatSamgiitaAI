import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { alignChart, similarity, wordKey } from "@/lib/psColleagues/chordAlign"
import { colleagueChartsOf, type ColleagueChart } from "@/lib/psColleagues/chords"
import { loadColleagueChords } from "@/lib/psColleagues/load"
import { splitLyricLines } from "@/lib/sargamDisplay"

/** A Word page: every even line is a chord line, every odd line its words. */
function page(...lines: string[]): ColleagueChart {
  return { source: { kind: "docx" }, capo: { kind: "none" }, lines, chordLines: lines.map((_, i) => i).filter((i) => i % 2 === 0), hasWords: true } as ColleagueChart
}

const chordsOver = (columns: Array<Array<{ word: string; chord: string | null }>>) => columns.map((line) => line.map((c) => (c.chord ? `${c.chord}>${c.word}` : c.word)).join(" "))

describe("chord alignment of a colleague's page to the song's own lines", () => {
  it("compares words by their letters, accents and doubled letters off", () => {
    expect(wordKey("JHARAŃÁ")).toBe("jharana")
    expect(wordKey("ámá-a-a-a-r")).toBe("amar")
    expect(wordKey("pákhii")).toBe("pakhi")
    expect(similarity("amar", "amar")).toBe(1)
    expect(similarity("", "x")).toBe(0)
  })

  it("puts each chord over the word of the song's line it stood over", () => {
    const chart = page("C           F", "BANDHU ÁMÁR  SONÁR ÁLOY", "G", "DHÁKÁ BANDHU")
    const result = alignChart(chart, ["Bandhu ámár sonár áloy", "Dháká bandhu"])
    expect(result.kind).toBe("aligned")
    if (result.kind !== "aligned") return
    expect(chordsOver(result.columns)).toEqual(["C>Bandhu ámár F>sonár áloy", "G>Dháká bandhu"])
  })

  it("keeps the song's own spelling and takes a sung extension for the word it extends", () => {
    const chart = page(`C${" ".repeat(19)}F`, "BANDHU ÁMÁ-A-A-AR  SONÁR")
    const result = alignChart(chart, ["Bandhu ámár sonár"])
    expect(result.kind === "aligned" && chordsOver(result.columns)).toEqual(["C>Bandhu ámár F>sonár"])
  })

  it("one document row that holds several lines of the song is spread over them", () => {
    const chart = page(`C${" ".repeat(8)}F${" ".repeat(11)}G`, "ONE TWO  THREE FOUR  FIVE SIX")
    const result = alignChart(chart, ["One two", "Three four", "Five six"])
    expect(result.kind === "aligned" && chordsOver(result.columns)).toEqual(["C>One two", "F>Three four", "G>Five six"])
  })

  it("a stanza the document repeats with the same chords adds nothing and loses nothing", () => {
    const chart = page("C      F", "ONE TWO  THREE", "C      F", "ONE TWO  THREE")
    const result = alignChart(chart, ["One two three"])
    expect(result.kind).toBe("aligned")
  })

  it("a repeat with other chords than the first time cannot be placed: the page is a list", () => {
    const chart = page("C      F", "ONE TWO  THREE", "G      D", "ONE TWO  THREE")
    expect(alignChart(chart, ["One two three"])).toEqual({ kind: "list", reason: "lost-chords" })
  })

  it("a song text that is not the page's text is a list, never a guess", () => {
    const chart = page("C      F", "ONE TWO  THREE")
    expect(alignChart(chart, ["Completely other words here"]).kind).toBe("list")
  })

  it("a page of chords alone, and a song with no text, are lists", () => {
    expect(alignChart({ ...page("C F"), hasWords: false }, ["One two"])).toEqual({ kind: "list", reason: "no-words" })
    expect(alignChart(page("C", "ONE"), [])).toEqual({ kind: "list", reason: "no-text" })
  })
})

describe("on the real chord pages of the documents", () => {
  it("lays most of the 73 pages over the song's lines and never writes a chord the page does not hold", async () => {
    const songs = JSON.parse(readFileSync(path.resolve(__dirname, "../../../data/generated/songs.json"), "utf8")) as Array<{ number: number; lyrics_original: string | null }>
    const byNumber = new Map(songs.map((s) => [s.number, s]))
    const wire = await loadColleagueChords()
    let aligned = 0
    for (const number of Object.keys(wire.docx)) {
      const chart = colleagueChartsOf(wire, Number(number)).find((c) => c.source.kind === "docx")
      if (!chart) continue
      const result = alignChart(chart, splitLyricLines(byNumber.get(Number(number))?.lyrics_original))
      if (result.kind !== "aligned") continue
      aligned += 1
      const held = new Set(chart.chordLines.flatMap((i) => (chart.lines[i] as string).trim().split(/\s+/)).filter(Boolean).map((c) => c.replace(/С/g, "C")))
      for (const line of result.columns) {
        for (const column of line) for (const chord of (column.chord ?? "").split(" ").filter(Boolean)) expect(held.has(chord.replace(/С/g, "C")), `chord ${chord} of song ${number}`).toBe(true)
      }
    }
    expect(aligned).toBeGreaterThanOrEqual(30)
  })
})
