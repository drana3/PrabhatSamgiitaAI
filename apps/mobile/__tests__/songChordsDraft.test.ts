import { describe, expect, it } from "vitest"

import { isChordName, suggestedChords, usedChords } from "@/lib/songChords/chordName"
import { chartOf } from "@/lib/songChords/types"
import {
  chordAt,
  clearLine,
  countChords,
  draftProblems,
  fitLines,
  newDraft,
  nextSlot,
  previousSlot,
  setCapo,
  setChord,
  setInstrument,
  soundingKey,
  toChart,
  toPayload,
  type Draft,
} from "@/lib/songChords/draft"
import { layoutChart, splitWords } from "@/lib/songPage/chordChart"
import { harmoniumChord, spShape } from "@/lib/songPage/spChords"

const LYRICS = ["Bhaja mana nirantara", "Śiva kṛṣṇa nāma"]
const COUNTS = LYRICS.map((l) => splitWords(l).length)

function filled(over: Partial<Draft> = {}): Draft {
  let d = fitLines({ ...newDraft(19), playedIt: true, ...over }, LYRICS.length)
  d = setChord(d, 0, 0, "G")
  d = setChord(d, 0, 2, "Em")
  d = setChord(d, 1, 1, "D7")
  return d
}

describe("chord names", () => {
  it("accepts real chord names and refuses the rest", () => {
    for (const ok of ["C", "F#m", "Bbmaj7", "Dsus4", "G/B", "Em7", "A7", "Cadd9"]) expect(isChordName(ok), ok).toBe(true)
    for (const bad of ["", "H", "am", "X7", "C;", "Am DROP", "C/", "1"]) expect(isChordName(bad), bad).toBe(false)
  })
  it("suggests the usual chords of a key", () => {
    expect(suggestedChords("G")).toEqual(["G", "C", "D", "Em", "Am", "Bm", "D7"])
    expect(suggestedChords("Eb")[0]).toBe("Eb")
    expect(suggestedChords("nonsense")).toEqual([])
  })
  it("lists the chords already used, most used first", () => {
    expect(usedChords([[{ chord: "G" }, { chord: "C" }], [{ chord: "C" }]])).toEqual(["C", "G"])
  })
})

describe("the editor model", () => {
  it("puts, replaces and clears a chord over a word", () => {
    let d = fitLines(newDraft(19), 2)
    d = setChord(d, 0, 1, "Am")
    d = setChord(d, 0, 0, "C")
    expect(d.lines[0]).toEqual([{ word: 0, chord: "C" }, { word: 1, chord: "Am" }])
    d = setChord(d, 0, 1, "Dm")
    expect(chordAt(d, 0, 1)).toBe("Dm")
    d = setChord(d, 0, 1, null)
    expect(chordAt(d, 0, 1)).toBeNull()
    expect(countChords(d)).toBe(1)
    expect(clearLine(d, 0).lines[0]).toEqual([])
  })
  it("does not change the draft for a line that does not exist", () => {
    const d = fitLines(newDraft(19), 1)
    expect(setChord(d, 5, 0, "C")).toBe(d)
    expect(setChord(d, 0, -1, "C")).toBe(d)
  })
  it("keeps chords when the number of lines is fitted", () => {
    const d = filled()
    expect(fitLines(d, 1).lines).toHaveLength(1)
    expect(fitLines(d, 3).lines[0]).toEqual(d.lines[0])
  })
  it("walks the words in reading order across lines", () => {
    expect(nextSlot(COUNTS, 0, 0)).toEqual({ line: 0, word: 1 })
    expect(nextSlot(COUNTS, 0, 2)).toEqual({ line: 1, word: 0 })
    expect(nextSlot(COUNTS, 1, 2)).toBeNull()
    expect(previousSlot(COUNTS, 1, 0)).toEqual({ line: 0, word: 2 })
    expect(previousSlot(COUNTS, 0, 0)).toBeNull()
  })
  it("a harmonium has no capo and no strum", () => {
    let d = setCapo({ ...newDraft(19), strum: "D U" }, 3)
    expect(d.capo).toBe(3)
    d = setInstrument(d, "harmonium")
    expect(d).toMatchObject({ instrument: "harmonium", capo: 0, strum: "" })
    expect(setCapo(d, 4).capo).toBe(0)
    expect(setCapo(setInstrument(d, "guitar"), 99).capo).toBe(7)
  })
})

describe("problems that stop a draft", () => {
  it("lists them in the order the form meets them", () => {
    expect(draftProblems(newDraft(null), COUNTS)).toEqual(["noSong", "noChords", "notPlayed"])
    expect(draftProblems(filled(), COUNTS)).toEqual([])
    expect(draftProblems(filled({ playedIt: false }), COUNTS)).toEqual(["notPlayed"])
    expect(draftProblems(setChord(filled(), 0, 1, "Q9"), COUNTS)).toEqual(["badChord"])
    expect(draftProblems(filled({ strum: "<script>" }), COUNTS)).toEqual(["strumShape"])
    expect(draftProblems(filled({ note: "x".repeat(301) }), COUNTS)).toEqual(["noteTooLong"])
  })
  it("ignores chords on words that do not exist", () => {
    const d = setChord(fitLines({ ...newDraft(19), playedIt: true }, 1), 0, 9, "C")
    expect(draftProblems(d, [4])).toEqual(["noChords"])
  })
})

describe("mapping to the song page's chart", () => {
  it("a guitar draft is stored as sounding chords with the capo as a hint", () => {
    const d = filled({ instrument: "guitar", key: "G", capo: 2, strum: "D  D U" })
    const payload = toPayload(d, COUNTS)
    expect(payload).toMatchObject({ songId: 19, instrument: "guitar", baseKey: "A", capo: 2, strum: "D D U", playedIt: true })
    // G shapes with the capo on 2 sound as A; Em as F#m; D7 as E7
    expect(payload.lines[0].placements).toEqual([{ word: 0, chord: "A" }, { word: 2, chord: "F#m" }])
    expect(payload.lines[1].placements).toEqual([{ word: 1, chord: "E7" }])
  })
  it("the song page shows the shapes the author played when the capo is theirs", () => {
    const d = filled({ instrument: "guitar", key: "G", capo: 2 })
    const chart = toChart(d, COUNTS)
    const laid = layoutChart(LYRICS, chart, (chord) => spShape(chord, 2), true)
    expect(laid[0].map((c) => c.chord)).toEqual(["G", null, "Em"])
    expect(laid[1].map((c) => c.chord)).toEqual([null, "D7", null])
  })
  it("a different capo shows other shapes for the same sounding chart", () => {
    const chart = toChart(filled({ instrument: "guitar", key: "G", capo: 2 }), COUNTS)
    const laid = layoutChart(LYRICS, chart, (chord) => spShape(chord, 0), true)
    expect(laid[0][0].chord).toBe("A")
  })
  it("a harmonium draft keeps its chords and Sa, and moves with the player's key", () => {
    const d = filled({ instrument: "harmonium", key: "C" })
    const payload = toPayload(d, COUNTS)
    expect(payload).toMatchObject({ instrument: "harmonium", baseKey: "C", capo: 0, strum: null })
    expect(soundingKey(d)).toBe("C")
    const chart = toChart(d, COUNTS)
    const laid = layoutChart(LYRICS, chart, (chord) => harmoniumChord(chord, chart.baseKey, "D"), true)
    expect(laid[0][0].chord).toBe("A") // G with Sa = C; the player puts Sa on D, two semitones up, so it is A
  })
  it("drops trailing empty lines and words past the end of a line", () => {
    const d = setChord(filled(), 1, 1, null)
    const payload = toPayload(setChord(d, 0, 2, "Em"), COUNTS)
    expect(payload.lines).toHaveLength(1)
    const long = fitLines({ ...newDraft(19), playedIt: true }, 1)
    expect(toPayload(setChord(setChord(long, 0, 0, "C"), 0, 8, "G"), [4]).lines[0].placements).toEqual([{ word: 0, chord: "C" }])
  })
  it("refuses to build a payload without a song", () => {
    expect(() => toPayload(newDraft(null), COUNTS)).toThrow()
  })
  it("a proposal of the API becomes a chart of the same shape", () => {
    const chart = chartOf({ baseKey: "A", strum: null, status: "published", lines: [{ placements: [{ word: 0, chord: "A" }] }] })
    expect(chart).toEqual({ reviewed: true, baseKey: "A", strum: undefined, lines: [{ placements: [{ word: 0, chord: "A" }] }] })
  })
})
