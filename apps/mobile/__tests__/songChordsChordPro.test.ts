import { describe, expect, it } from "vitest"

import { normaliseWord, parseChordPro, toChordPro } from "@/lib/songChords/chordPro"
import { fitLines, newDraft, setChord, toPayload } from "@/lib/songChords/draft"
import { splitWords } from "@/lib/songPage/chordChart"

const LYRICS = ["Bhaja mana nirantara", "Śiva kṛṣṇa nāma", "Hari bol"]

const codes = (text: string, lyrics = LYRICS.slice(0, 1)) => parseChordPro(text, lyrics).issues.map((i) => `${i.level}:${i.code}@${i.line}`)

describe("ChordPro text", () => {
  it("reads a chord in front of a word", () => {
    const r = parseChordPro("[G]Bhaja mana [Em]nirantara\nŚiva [D7]kṛṣṇa nāma\nHari bol", LYRICS)
    expect(r.ok).toBe(true)
    expect(r.issues).toEqual([])
    expect(r.lines).toEqual([
      [{ word: 0, chord: "G" }, { word: 2, chord: "Em" }],
      [{ word: 1, chord: "D7" }],
      [],
    ])
  })
  it("a chord in the middle of a word belongs to that word", () => {
    const r = parseChordPro("Bha[G]ja mana nirantara", LYRICS)
    expect(r.lines[0]).toEqual([{ word: 0, chord: "G" }])
  })
  it("a chord followed by a space still lands on the next word", () => {
    expect(parseChordPro("Bhaja [Am] mana nirantara", LYRICS).lines[0]).toEqual([{ word: 1, chord: "Am" }])
  })
  it("ignores blank lines, comments and unknown directives, and reads capo, key and strum", () => {
    const r = parseChordPro("{title: x}\n{capo: 2}\n{key: G}\n{strum: D D U}\n# a comment\n\n[G]Bhaja mana nirantara\n\nŚiva kṛṣṇa nāma\nHari bol", LYRICS)
    expect(r.ok).toBe(true)
    expect(r.meta).toEqual({ capo: 2, key: "G", strum: "D D U" })
    expect(r.lines[0]).toEqual([{ word: 0, chord: "G" }])
  })
  it("accepts lower-case and fancy accidentals in a chord", () => {
    expect(parseChordPro("[am]Bhaja [F♯m]mana nirantara", LYRICS).lines[0]).toEqual([{ word: 0, chord: "Am" }, { word: 1, chord: "F#m" }])
  })
  it("says which line and place is wrong", () => {
    expect(codes("[Gbhaja mana nirantara")).toEqual(["error:unclosed@1"])
    expect(codes("[]Bhaja mana nirantara")).toEqual(["error:emptyChord@1"])
    expect(codes("[H7]Bhaja mana nirantara")).toEqual(["error:badChord@1"])
    expect(codes("Bhaja mana nirantara [G]")).toEqual(["error:trailingChord@1"])
    expect(codes("{capo: 9}")).toEqual(["error:badCapo@1"])
    const bad = parseChordPro("[H7]Bhaja mana nirantara", LYRICS).issues[0]
    expect(bad).toMatchObject({ line: 1, column: 1, params: { chord: "H7" } })
  })
  it("a line with another number of words is an error with the numbers", () => {
    const r = parseChordPro("Bhaja mana\nŚiva kṛṣṇa nāma", LYRICS)
    expect(r.ok).toBe(false)
    expect(r.issues[0]).toMatchObject({ code: "wordCount", line: 1, params: { lyricLine: 1, expected: 3, found: 2 } })
    // the good line is kept, the bad one gives nothing
    expect(r.lines[0]).toEqual([])
  })
  it("more lines than the song is one error, fewer is only a warning", () => {
    const many = parseChordPro("a b c\nd e f\ng h\ni\nj", LYRICS)
    expect(many.issues.filter((i) => i.code === "extraLines")).toHaveLength(1)
    const few = parseChordPro("[G]Bhaja mana nirantara", LYRICS)
    expect(few.ok).toBe(true)
    expect(few.issues.map((i) => i.code)).toEqual(["fewerLines"])
  })
  it("warns, but accepts, when the words differ from the lyric", () => {
    const r = parseChordPro("[G]Bhajan mana nirantara", LYRICS)
    expect(r.ok).toBe(true)
    expect(r.issues[0]).toMatchObject({ level: "warning", code: "wordMismatch", params: { typed: "Bhajan", expected: "Bhaja" } })
  })
  it("compares words without capitals, accents or punctuation", () => {
    expect(normaliseWord("Śiva,")).toBe(normaliseWord("siva"))
    expect(parseChordPro("[G]shiva kṛṣṇa nāma", ["Śiva kṛṣṇa nāma"]).issues.map((i) => i.code)).toEqual(["wordMismatch"])
    expect(parseChordPro("[G]SIVA krsna nama", ["Śiva kṛṣṇa nāma"]).issues).toEqual([])
  })
  it("two chords on one word keep the first and warn", () => {
    const a = parseChordPro("[G][C]Bhaja mana nirantara", LYRICS.slice(0, 1))
    expect(a.lines[0]).toEqual([{ word: 0, chord: "G" }])
    expect(a.issues[0]).toMatchObject({ level: "warning", code: "secondChord", params: { chord: "C", kept: "G" } })
    const b = parseChordPro("Bha[G]ja[C] mana nirantara", LYRICS.slice(0, 1))
    expect(b.lines[0]).toEqual([{ word: 0, chord: "G" }])
    expect(b.issues.map((i) => i.code)).toEqual(["secondChord"])
  })
  it("handles Windows line ends", () => {
    expect(parseChordPro("[G]Bhaja mana nirantara\r\nŚiva kṛṣṇa nāma\r\nHari bol", LYRICS).ok).toBe(true)
  })
  it("round-trips with the text export, and ends in the same payload as the tap editor", () => {
    let d = fitLines({ ...newDraft(19), playedIt: true }, LYRICS.length)
    d = setChord(d, 0, 0, "G")
    d = setChord(d, 0, 2, "Em")
    d = setChord(d, 2, 1, "C/G")
    const text = toChordPro(d.lines, LYRICS)
    expect(text).toBe("[G]Bhaja mana [Em]nirantara\nŚiva kṛṣṇa nāma\nHari [C/G]bol")
    const parsed = parseChordPro(text, LYRICS)
    expect(parsed.issues).toEqual([])
    expect(parsed.lines).toEqual(d.lines)
    const counts = LYRICS.map((l) => splitWords(l).length)
    expect(toPayload({ ...d, lines: parsed.lines }, counts)).toEqual(toPayload(d, counts))
  })
})
