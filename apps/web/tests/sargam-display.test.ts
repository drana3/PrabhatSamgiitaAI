import { describe, expect, it } from "vitest"

import {
  alignNotationToSongLines,
  buildDisplayNotes,
  distributeNotesToWords,
  formatPracticeSequence,
  harmoniumKeyLabel,
  isBengaliText,
  lineNotes,
  notationCoverage,
  practiceLyricSource,
  resolveLineLyrics,
  sargamVariant,
  toDevanagariSwara,
  toLatinSwara,
} from "@/lib/sargam-display"
import type { NotationLine } from "@/lib/api"

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

describe("sargam-display", () => {
  it("flattens beat notes in order", () => {
    expect(lineNotes(sampleLine)).toHaveLength(3)
  })

  it("maps sargam tokens to learner-friendly Hindi Devanagari", () => {
    expect(toDevanagariSwara("P")).toBe("प")
    expect(toDevanagariSwara("m")).toBe("म")
    expect(toDevanagariSwara("N")).toBe("नि")
    expect(toDevanagariSwara("n")).toBe("नि॒")
    expect(toDevanagariSwara("M")).toBe("म॑")
    expect(toDevanagariSwara("r")).toBe("रे॒")
    expect(toDevanagariSwara("S", "upper")).toBe("सां")
  })

  it("marks komal and tivra variants", () => {
    expect(sargamVariant("m")).toBe("komal")
    expect(sargamVariant("M")).toBe("tivra")
    expect(sargamVariant("G")).toBe("shuddh")
  })

  it("builds a readable practice sequence with keys", () => {
    const notes = buildDisplayNotes(sampleLine)
    expect(toLatinSwara("m")).toBe("ma")
    expect(formatPracticeSequence(notes, "devanagari")).toBe("प · म · ग")
    expect(formatPracticeSequence(notes, "latin")).toBe("Pa · ma · Ga")
    expect(formatPracticeSequence(notes, "key")).toBe("G · F · D")
  })

  it("prefers Roman transliteration when lyrics are Bengali", () => {
    expect(isBengaliText("এ গান আমার")).toBe(true)
    const source = practiceLyricSource({
      lyricsOriginal: "এ গান আমার\nউপল পথে",
      transliteration: "E gan amar\nUpala pathe",
    })
    expect(source.practiceText).toContain("E gan amar")
    expect(source.originalText).toContain("এ গান")
  })

  it("extracts harmonium key labels from western notes", () => {
    expect(harmoniumKeyLabel("C#4")).toBe("C#")
    expect(harmoniumKeyLabel(null, "S")).toBe("Sa")
  })

  it("distributes sargam notes across lyric words for a line", () => {
    const groups = distributeNotesToWords(["BANDHU", "HE", "NIYE", "CALO"], buildDisplayNotes(sampleLine))
    expect(groups).toHaveLength(4)
    expect(groups[0].word).toBe("BANDHU")
    expect(groups[0].notes[0].devanagari).toBe("प")
  })

  it("resolves lyric text for a notation line index", () => {
    const resolved = resolveLineLyrics(
      sampleLine,
      0,
      ["BANDHU HE NIYE CALO", "ALOR OI JHARANA"],
      ["बंधु हे"],
    )
    expect(resolved.roman).toBe("BANDHU HE NIYE CALO")
    expect(resolved.original).toBe("बंधु हे")
  })

  it("aligns to the union of lyric and notation lines", () => {
    const aligned = alignNotationToSongLines([sampleLine], ["one", "two", "three"])
    expect(aligned).toHaveLength(3)
    expect(aligned[0]?.line).toBeTruthy()
    expect(aligned[2]?.line).toBeNull()
    expect(notationCoverage(1, 3).incomplete).toBe(true)
  })
})
