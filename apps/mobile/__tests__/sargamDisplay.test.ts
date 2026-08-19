import { describe, expect, it } from "vitest"

import {
  alignNotationToSongLines,
  buildDisplayNotes,
  distributeNotesToWords,
  formatPracticeSequence,
  harmoniumKeyLabel,
  isBengaliText,
  notationCoverage,
  practiceLyricSource,
  resolveLineLyrics,
  splitLyricLines,
  toDevanagariSwara,
  toLatinSwara,
  type NotationLine,
} from "@/lib/sargamDisplay"

const sampleLine: NotationLine = {
  line_number: 1,
  lyrics: "BANDHU HE NIYE CALO",
  measures: [
    {
      beats: [
        { beat: 1, notes: [{ sargam: "P", western: "G4", duration: 1, octave: "middle" }] },
        { beat: 2, notes: [{ sargam: "m", western: "F4", duration: 1, octave: "middle" }] },
        { beat: 3, notes: [{ sargam: "G", western: "D4", duration: 1, octave: "middle" }] },
      ],
    },
  ],
}

describe("sargamDisplay (mobile)", () => {
  it("maps tokens to learner-friendly Hindi Sargam", () => {
    const notes = buildDisplayNotes(sampleLine)
    expect(toLatinSwara("m")).toBe("ma")
    expect(toDevanagariSwara("P")).toBe("प")
    expect(toDevanagariSwara("N")).toBe("नि")
    expect(toDevanagariSwara("n")).toBe("नि॒")
    expect(toDevanagariSwara("M")).toBe("म॑")
    expect(formatPracticeSequence(notes, "devanagari")).toBe("प · म · ग")
    expect(formatPracticeSequence(notes, "latin")).toBe("Pa · ma · Ga")
    expect(formatPracticeSequence(notes, "key")).toBe("G · F · D")
  })

  it("prefers Roman practice lines when lyrics are Bengali", () => {
    expect(isBengaliText("এ গান")).toBe(true)
    expect(
      practiceLyricSource({
        lyricsOriginal: "এ গান আমার",
        transliteration: "E gan amar",
      }).practiceText,
    ).toBe("E gan amar")
  })

  it("strips octave from western keys", () => {
    expect(harmoniumKeyLabel("C#4")).toBe("C#")
    expect(harmoniumKeyLabel(null, "S")).toBe("Sa")
  })

  it("distributes notes across lyric words", () => {
    const groups = distributeNotesToWords(
      ["BANDHU", "HE", "NIYE", "CALO"],
      buildDisplayNotes(sampleLine),
    )
    expect(groups).toHaveLength(4)
    expect(groups[0]?.notes[0]?.latin).toBe("Pa")
  })

  it("splits lyrics on danda and pipes when newlines are missing", () => {
    expect(splitLyricLines("Bandhu he | niye calo | maner mukul")).toEqual([
      "Bandhu he",
      "niye calo",
      "maner mukul",
    ])
    const aligned = alignNotationToSongLines([sampleLine], ["one", "two", "three"])
    expect(aligned).toHaveLength(3)
    expect(aligned[0]?.line).toBeTruthy()
    expect(aligned[2]?.line).toBeNull()
  })

  it("uses the union of lyric and notation lines so neither side is dropped", () => {
    const twoLines = alignNotationToSongLines(
      [sampleLine, sampleLine, sampleLine],
      ["first lyric", "second lyric"],
    )
    expect(twoLines).toHaveLength(3)
    expect(resolveLineLyrics(sampleLine, 0, ["first lyric", "second lyric"]).roman).toBe("first lyric")
  })

  it("keeps multi-line notation when lyrics are a single unsplit blob", () => {
    const aligned = alignNotationToSongLines(
      [sampleLine, sampleLine, sampleLine],
      ["Bandhu he niye calo maner mukul"],
    )
    expect(aligned).toHaveLength(3)
    expect(aligned.every((row) => row.line)).toBe(true)
  })

  it("reports incomplete coverage when notation is shorter than lyrics", () => {
    expect(notationCoverage(4, 12)).toEqual({ covered: 4, total: 12, incomplete: true })
    expect(notationCoverage(8, 6).incomplete).toBe(false)
  })
})
