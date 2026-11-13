import { describe, expect, it } from "vitest"

import {
  activeLineIndex,
  activeWordIndex,
  alignTranslation,
  autoScrollReduce,
  buildLyricLines,
  lineState,
  LYRICS_HAVE_TIMESTAMPS,
  lyricsAreSynced,
  lineTimings,
  scrollOffsetForLine,
  seekTargetForLine,
  sentenceCaseLine,
  splitLines,
  wordState,
} from "@/lib/playerV2/lyricsSync"

describe("karaoke lyrics", () => {
  const lines = splitLines("Bandhu he niye calo\n\n  Alo ' r pathe  \nPrabhu\n")

  it("splits lines and trims blanks", () => {
    expect(lines).toEqual(["Bandhu he niye calo", "Alo ' r pathe", "Prabhu"])
    expect(splitLines(null)).toEqual([])
  })

  it("aligns a translation only when the line counts match", () => {
    expect(alignTranslation(lines, "a\nb\nc")).toEqual(["a", "b", "c"])
    expect(alignTranslation(lines, "one paragraph")).toBeNull()
    expect(alignTranslation([], "")).toBeNull()
  })

  it("times lines across the song with a lead-in and a tail", () => {
    const t = lineTimings(lines, 200)
    expect(t).toHaveLength(3)
    expect(t[0]?.start).toBeCloseTo(8, 5)
    expect(t[2]?.end).toBeCloseTo(194, 5)
    for (let i = 1; i < t.length; i += 1) expect(t[i]?.start).toBeCloseTo(t[i - 1]!.end, 5)
    expect(lineTimings(lines, 0)).toEqual([])
    expect(lineTimings([], 200)).toEqual([])
  })

  it("finds the line being sung", () => {
    const t = lineTimings(lines, 200)
    expect(activeLineIndex(t, 0)).toBe(-1)
    expect(activeLineIndex(t, t[0]!.start)).toBe(0)
    expect(activeLineIndex(t, t[1]!.start + 0.1)).toBe(1)
    expect(activeLineIndex(t, 199)).toBe(2)
    expect(activeLineIndex([], 5)).toBe(-1)
  })

  it("moves the word highlight across the line", () => {
    const words = ["Bandhu", "he", "niye", "calo"]
    const timing = { start: 10, end: 20 }
    expect(activeWordIndex(words, timing, 9)).toBe(-1)
    expect(activeWordIndex(words, timing, 10.1)).toBe(0)
    expect(activeWordIndex(words, timing, 19.9)).toBe(3)
    const seen = new Set<number>()
    for (let p = 10; p < 20; p += 0.25) seen.add(activeWordIndex(words, timing, p))
    expect([...seen].sort()).toEqual([0, 1, 2, 3])
  })

  it("classifies lines and words for styling", () => {
    expect(lineState(1, 1)).toBe("current")
    expect(lineState(0, 1)).toBe("done")
    expect(lineState(2, 1)).toBe("coming")
    expect(wordState(0, 1, true)).toBe("sung")
    expect(wordState(1, 1, true)).toBe("current")
    expect(wordState(2, 1, true)).toBe("coming")
    expect(wordState(0, 1, false)).toBe("coming")
  })

  it("seeks to the line start when a line is tapped", () => {
    const t = lineTimings(lines, 200)
    expect(seekTargetForLine(t, 1)).toBe(t[1]!.start)
    expect(seekTargetForLine(t, 9)).toBeNull()
  })

  it("pauses auto-scroll on touch until the line changes", () => {
    let s = autoScrollReduce({ paused: false, lineAtPause: -1 }, { type: "line", line: 2 })
    expect(s.paused).toBe(false)
    s = autoScrollReduce(s, { type: "touch", line: 2 })
    expect(s.paused).toBe(true)
    s = autoScrollReduce(s, { type: "line", line: 2 })
    expect(s.paused).toBe(true)
    s = autoScrollReduce(s, { type: "line", line: 3 })
    expect(s.paused).toBe(false)
  })

  it("scrolls so the current line sits near the top", () => {
    expect(scrollOffsetForLine(500, 400)).toBe(428)
    expect(scrollOffsetForLine(10, 400)).toBe(0)
  })

  it("keeps glosses and translations on the words and lines", () => {
    const built = buildLyricLines(["a b", "c"], ["x", "y"], [["A", undefined], ["C"]])
    expect(built[0]).toEqual({
      text: "a b",
      translation: "x",
      words: [{ text: "a", gloss: "A" }, { text: "b", gloss: undefined }],
    })
    expect(built[1]?.words[0]?.gloss).toBe("C")
  })
})

describe("sentenceCaseLine", () => {
  it("lowers a line that is all capitals and keeps its first letter", () => {
    expect(sentenceCaseLine("BANDHU HE NIYE CALO")).toBe("Bandhu he niye calo")
    expect(sentenceCaseLine("ÁLOR OI JHARAŃÁ")).toBe("Álor oi jharańá")
  })
  it("leaves mixed case, short lines and uncased scripts alone", () => {
    expect(sentenceCaseLine("Bandhu he Niye calo")).toBe("Bandhu he Niye calo")
    expect(sentenceCaseLine("OM")).toBe("OM")
    expect(sentenceCaseLine("बन्धु हे")).toBe("बन्धु हे")
  })
})

describe("lyrics without real timestamps (checkup P9)", () => {
  it("are plain text: only the prototype preview, or real timestamps, switch the highlight on", () => {
    expect(LYRICS_HAVE_TIMESTAMPS).toBe(false)
    expect(lyricsAreSynced(false)).toBe(false)
    expect(lyricsAreSynced(true)).toBe(true)
    expect(lyricsAreSynced(false, true)).toBe(true)
  })

  it("every line reads the same when not synced, whatever the guessed line is", () => {
    expect([0, 1, 2].map((i) => lineState(i, 1, false))).toEqual(["current", "current", "current"])
    expect([0, 1, 2].map((i) => lineState(i, 1))).toEqual(["done", "current", "coming"])
  })
})

