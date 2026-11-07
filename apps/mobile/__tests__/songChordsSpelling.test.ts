import { describe, expect, it } from "vitest"

import { isChordName, suggestedChords } from "@/lib/songChords/chordName"
import { parseChordPro } from "@/lib/songChords/chordPro"
import { draftFromProposal, fitLines, newDraft, setCapo, setChord, soundingKey, toPayload } from "@/lib/songChords/draft"
import { shiftChord } from "@/lib/songChords/spelling"
import type { ChordProposal } from "@/lib/songChords/types"
import { parseChord } from "@/lib/songPage/chords"

describe("shiftChord keeps the way a chord was written (QA-012)", () => {
  it("does not touch a chord that is not moved", () => {
    for (const name of ["Db", "G#m", "C#", "Bbmaj7", "A/C#", "Eb/Bb"]) expect(shiftChord(name, 0)).toBe(name)
  })
  it("keeps sharps sharp and flats flat when the pitch moves", () => {
    expect(shiftChord("G#m", 2)).toBe("A#m")
    expect(shiftChord("Db", 2)).toBe("Eb")
    expect(shiftChord("Db", -2)).toBe("B")
    expect(shiftChord("C#", 1)).toBe("D")
    expect(shiftChord("F#7", 2)).toBe("G#7")
    expect(shiftChord("Bb", 3)).toBe("Db")
  })
  it("a plain letter that must take a mark gets the song page's spelling", () => {
    expect(shiftChord("C", 1)).toBe("C#")
    expect(shiftChord("A", 1)).toBe("Bb")
    expect(shiftChord("F", -2)).toBe("Eb")
  })
  it("moves the bass note and keeps its style", () => {
    expect(shiftChord("A/C#", 2)).toBe("B/D#")
    expect(shiftChord("Eb/Bb", 2)).toBe("F/C")
    expect(shiftChord("C/E", 1)).toBe("C#/F")
  })
  it("leaves a name it cannot read alone", () => {
    expect(shiftChord("hello", 3)).toBe("hello")
  })
  it("a shape goes up by the capo and back down to the very same name", () => {
    for (const name of ["G#m", "Db", "F#7", "Bbmaj7", "D", "A/C#", "Em7"]) {
      for (let capo = 0; capo <= 7; capo += 1) {
        const there = shiftChord(name, capo)
        const pitch = (n: string) => parseChord(n)?.root
        expect(pitch(there)).toBe(((pitch(name)! + capo) % 12 + 12) % 12)
        // the pitch always comes back; the name does for every chord that has a mark of its own
        expect(pitch(shiftChord(there, -capo))).toBe(pitch(name))
      }
    }
  })
})

const proposal = (over: Partial<ChordProposal> = {}): ChordProposal =>
  ({
    id: "p1",
    songId: 19,
    instrument: "guitar",
    baseKey: "Db",
    capo: 0,
    strum: null,
    lines: [{ placements: [{ word: 0, chord: "Db" }, { word: 1, chord: "G#m" }] }],
    status: "rejected",
    playedIt: true,
    note: null,
    isAnonymous: false,
    ...over,
  }) as ChordProposal

describe("editing a chart does not rename its chords", () => {
  it("capo 0: what comes in is what goes out", () => {
    const draft = draftFromProposal(proposal(), "edit")
    expect(draft.key).toBe("Db")
    expect(draft.lines[0].map((p) => p.chord)).toEqual(["Db", "G#m"])
    const back = toPayload({ ...draft, songId: 19 }, [4])
    expect(back.baseKey).toBe("Db")
    expect(back.lines[0].placements.map((p) => p.chord)).toEqual(["Db", "G#m"])
  })
  it("a capo shifts the pitch and keeps each chord's own style on the way there and back", () => {
    const sent = proposal({ baseKey: "Eb", capo: 2, lines: [{ placements: [{ word: 0, chord: "Eb" }, { word: 1, chord: "A#m" }] }] })
    const draft = draftFromProposal(sent, "edit")
    expect(draft.capo).toBe(2)
    expect(draft.lines[0].map((p) => p.chord)).toEqual(["Db", "G#m"])
    expect(soundingKey(draft)).toBe("Eb")
    expect(toPayload({ ...draft, songId: 19 }, [4]).lines[0].placements.map((p) => p.chord)).toEqual(["Eb", "A#m"])
  })
  it("a draft in a flat key stays in it when the capo changes", () => {
    const draft = setCapo({ ...newDraft(19), key: "Db" }, 0)
    expect(soundingKey(draft)).toBe("Db")
    const typed = setChord(fitLines(newDraft(19), 1), 0, 0, "G#m")
    expect(toPayload({ ...typed, songId: 19 }, [3]).lines[0].placements[0].chord).toBe("G#m")
  })
  it("suggested chords of a flat key are spelled as the key is", () => {
    expect(suggestedChords("Db").slice(0, 3)).toEqual(["Db", "Gb", "Ab"])
    expect(suggestedChords("F#").slice(0, 3)).toEqual(["F#", "B", "C#"])
  })
})

describe("chord grammar is the API's (QA-018)", () => {
  it("accepts the names musicians write", () => {
    for (const ok of ["C", "F#m", "Bbmaj7", "Dsus4", "G/B", "C6/9", "C°", "Cø", "Cdim", "Am7b5", "C7#9", "E+", "Cadd9", "D/F#", "A7(b9)"]) {
      expect(isChordName(ok), ok).toBe(true)
    }
  })
  it("refuses what is not a chord", () => {
    for (const bad of ["Cfoo", "Cxyz", "Hm", "C//", "C m", "", "Cmmmmmmmmmmmm", "c", "Am; DROP", "C6/", "C/9/9"]) {
      expect(isChordName(bad), bad).toBe(false)
    }
  })
  it("the song page reads C6/9 and keeps it together", () => {
    const parsed = parseChord("C6/9")
    expect(parsed?.suffix).toBe("6/9")
    expect(parsed?.bass).toBeNull()
    expect(parseChord("C/E")?.suffix).toBe("")
    expect(parseChord("C/E")?.bass).toBe(4)
  })
})

describe("ChordPro {key} with a minor key (QA-019)", () => {
  const read = (text: string) => parseChordPro(`${text}\n[Am]Bhaja mana`, ["Bhaja mana"])
  it("sits a minor key on its relative major", () => {
    expect(read("{key: Am}").meta.key).toBe("C")
    expect(read("{key: Em}").meta.key).toBe("G")
    expect(read("{key: F#m}").meta.key).toBe("A")
    expect(read("{key: Bbm}").meta.key).toBe("Db")
  })
  it("still reads major keys and still refuses nonsense", () => {
    expect(read("{key: G}").meta.key).toBe("G")
    const bad = read("{key: Hm}")
    expect(bad.meta.key).toBeUndefined()
    expect(bad.issues.some((i) => i.code === "badChord")).toBe(true)
  })
})
