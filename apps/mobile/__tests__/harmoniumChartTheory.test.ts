import { describe, expect, it } from "vitest"

import { parseChord } from "@/lib/songPage/chords"
import { SP_NOTES, harmoniumChord, keyPitch, swaraRow } from "@/lib/songPage/spChords"
import { explainChord, spKeys, keyInChord, swaraOfPitch } from "@/lib/songPage/spKeyboard"

/**
 * The theory behind a harmonium chart. A chart is written in the key of Sa the author plays in; a reader sets their own Sa and
 * every chord moves by the distance between the two Sas. The tests check the PITCH (never a spelling) for every pair of Sa, then
 * the SPELLING (a musician writes G#m in E, not Abm), then the three keys of the explained chords.
 */
const mod12 = (n: number) => ((n % 12) + 12) % 12
const SAS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
const CHORDS = ["C", "Am", "F", "G", "G7", "Em", "Dm7", "Bdim", "Csus4", "Fmaj7", "G/B", "F#m", "Bb", "Ebm"]

describe("a harmonium chart moves to the reader's Sa", () => {
  it("moves every chord by exactly the distance between the two Sas (all 144 pairs)", () => {
    for (const from of SAS) {
      for (const to of SAS) {
        for (const chord of CHORDS) {
          const shown = harmoniumChord(chord, from, to)
          const before = parseChord(chord)!
          const after = parseChord(shown)
          expect(after, `${chord} ${from}->${to} gave ${shown}`).not.toBeNull()
          const move = mod12(keyPitch(to) - keyPitch(from))
          expect(after!.root).toBe(mod12(before.root + move))
          expect(after!.suffix).toBe(before.suffix)
          if (before.bass != null) expect(after!.bass).toBe(mod12(before.bass + move))
        }
      }
    }
  })

  it("leaves the chart exactly as typed when the reader plays in the author's Sa", () => {
    expect(harmoniumChord("G#m", "E", "E")).toBe("G#m")
    expect(harmoniumChord("Db", "Db", "Db")).toBe("Db")
    expect(harmoniumChord("Bb", "F", "F")).toBe("Bb")
  })

  it("spells the chords the way a musician writes them in that key", () => {
    // Sa = E (four sharps): the third is G#m, the sixth C#m, the second F#m
    expect(harmoniumChord("Em", "C", "E")).toBe("G#m")
    expect(harmoniumChord("Am", "C", "E")).toBe("C#m")
    expect(harmoniumChord("Dm", "C", "E")).toBe("F#m")
    // Sa = Bb (two flats): Eb and F, never D# and E#
    expect(harmoniumChord("F", "C", "Bb")).toBe("Eb")
    expect(harmoniumChord("Am", "C", "Bb")).toBe("Gm")
    // Sa = F# (six sharps): G# A# and C# stay sharp
    expect(harmoniumChord("Dm", "C", "F#")).toBe("G#m")
    expect(harmoniumChord("Em", "C", "F#")).toBe("A#m")
    // the song page's own names stay for C and for the keys it already spelled (D# is shown as Eb)
    expect(harmoniumChord("C", "C", "D#")).toBe("Eb")
    expect(harmoniumChord("Am", "C", "D#")).toBe("Cm")
    expect(harmoniumChord("G/B", "C", "D")).toBe("A/C#")
  })

  it("never writes a chord name outside the twelve the app knows", () => {
    for (const to of SAS) expect(SP_NOTES).toContain(swaraRow(to)[0]!.n)
  })
})

describe("the swaras and the three keys of a chord", () => {
  it("Sa = D: D E F# G A B C#", () => {
    expect(swaraRow("D").map((r) => r.n)).toEqual(["D", "E", "F#", "G", "A", "B", "C#"])
  })

  it("a major chord is the root, 4 and 7 semitones; a minor chord 3 and 7 (checked for every Sa)", () => {
    for (let sa = 0; sa < 12; sa += 1) {
      for (const base of ["C", "Am", "F", "G"]) {
        const chord = explainChord(base, sa)
        const root = chord.pitches[0]!
        expect(chord.pitches.map((p) => mod12(p - root))).toEqual([0, chord.minor ? 3 : 4, 7])
        expect(chord.minor).toBe(base.endsWith("m"))
      }
    }
  })

  it("lights exactly the three pressed keys, and names their swaras for Sa = D", () => {
    const chord = explainChord("C", keyPitch("D")) // C in the chart's key C, Sa = D: D major = D F# A
    expect(chord.name).toBe("D")
    const { whites, blacks } = spKeys(keyPitch("D"))
    const lit = [...whites, ...blacks].filter((key) => keyInChord(key, chord)).map((key) => key.note)
    expect(new Set(lit)).toEqual(new Set(["D", "F#", "A"]))
    expect(chord.pitches.map((p) => swaraOfPitch(p, keyPitch("D")))).toEqual(["Sa", "Ga", "Pa"])
  })
})
