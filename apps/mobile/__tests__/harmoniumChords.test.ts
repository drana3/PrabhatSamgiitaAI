import { describe, expect, it } from "vitest"

import {
  chordFormula,
  chordKeyIndexes,
  chordReadout,
  noteName,
  parseChord,
  pitchClassOf,
  semitonesFromSa,
  swaraAtSemitone,
  swaraNoteRow,
  windowAround,
  KEYBOARD_KEY_COUNT,
} from "@/lib/harmonium-v2/chords"

const D = pitchClassOf("D")!
const C = pitchClassOf("C")!

describe("note names and chord parsing", () => {
  it("reads note names including flats", () => {
    expect(pitchClassOf("C")).toBe(0)
    expect(pitchClassOf("F#")).toBe(6)
    expect(pitchClassOf("Bb")).toBe(10)
    expect(pitchClassOf("H")).toBeNull()
    expect(noteName(13)).toBe("C#")
    expect(noteName(-1)).toBe("B")
  })

  it("parses major, minor and seventh chords", () => {
    expect(parseChord("C")).toEqual({ name: "C", rootPitchClass: 0, quality: "major" })
    expect(parseChord("Am")).toEqual({ name: "Am", rootPitchClass: 9, quality: "minor" })
    expect(parseChord("F#m")?.name).toBe("F#m")
    expect(parseChord("Bb")?.name).toBe("A#")
    expect(parseChord("E7")?.quality).toBe("dominant7")
    expect(parseChord("Dmin")?.quality).toBe("minor")
    expect(parseChord("Xyz")).toBeNull()
    expect(parseChord("")).toBeNull()
  })
})

describe("swaras", () => {
  it("names swaras by semitones above Sa, komal lowercase and shuddha uppercase", () => {
    expect(swaraAtSemitone(0).latin).toBe("Sa")
    expect(swaraAtSemitone(1)).toEqual({ token: "r", latin: "re" })
    expect(swaraAtSemitone(2)).toEqual({ token: "R", latin: "Re" })
    expect(swaraAtSemitone(3).token).toBe("g")
    expect(swaraAtSemitone(6).latin).toBe("Ma♯")
    expect(swaraAtSemitone(7).latin).toBe("Pa")
    expect(swaraAtSemitone(11).latin).toBe("Ni")
    expect(swaraAtSemitone(12).latin).toBe("Sa")
    expect(swaraAtSemitone(-1).latin).toBe("Ni")
  })

  it("maps Sa = D to D E F# G A B C#", () => {
    expect(swaraNoteRow(D).map((row) => row.note)).toEqual(["D", "E", "F#", "G", "A", "B", "C#"])
    expect(swaraNoteRow(D).map((row) => row.name)).toEqual(["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"])
  })

  it("maps Sa = C to the white keys", () => {
    expect(swaraNoteRow(C).map((row) => row.note)).toEqual(["C", "D", "E", "F", "G", "A", "B"])
  })

  it("counts semitones above Sa around the octave", () => {
    expect(semitonesFromSa(pitchClassOf("D")!, D)).toBe(0)
    expect(semitonesFromSa(pitchClassOf("C")!, D)).toBe(10)
    expect(semitonesFromSa(pitchClassOf("C#")!, D)).toBe(11)
  })
})

describe("chord to swara mapping", () => {
  it("a major chord is root, +4, +7", () => {
    const readout = chordReadout(parseChord("C")!, C)
    expect(readout.keys.map((key) => key.note)).toEqual(["C", "E", "G"])
    expect(readout.keys.map((key) => key.fromRoot)).toEqual([0, 4, 7])
    expect(readout.keys.map((key) => key.swara.latin)).toEqual(["Sa", "Ga", "Pa"])
    expect(readout.formula).toBe("root, +4, +7")
    expect(readout.kindLabel).toBe("major")
    expect(readout.noteLine).toBe("C E G")
  })

  it("a minor chord is root, +3, +7 and uses komal ga", () => {
    const readout = chordReadout(parseChord("Am")!, C)
    expect(readout.keys.map((key) => key.note)).toEqual(["A", "C", "E"])
    expect(readout.keys.map((key) => key.swara.latin)).toEqual(["Dha", "Sa", "Ga"])
    expect(readout.formula).toBe("root, +3, +7")
    expect(readout.kindLabel).toBe("minor")
  })

  it("follows Sa: the same chord has different swaras in another key", () => {
    // G major with Sa = D is Pa Ni Re (G B D)
    const inD = chordReadout(parseChord("G")!, D)
    expect(inD.keys.map((key) => key.swara.latin)).toEqual(["Ma", "Dha", "Sa"])
    // Dm with Sa = D is Sa komal-ga Pa
    const dm = chordReadout(parseChord("Dm")!, D)
    expect(dm.keys.map((key) => key.swara.latin)).toEqual(["Sa", "ga", "Pa"])
    expect(dm.keys.map((key) => key.swara.token)).toEqual(["S", "g", "P"])
    expect(dm.swaraLine).toBe("Sa, ga, Pa")
  })

  it("a seventh chord adds a fourth key", () => {
    const readout = chordReadout(parseChord("E7")!, C)
    expect(readout.keys.map((key) => key.note)).toEqual(["E", "G#", "B", "D"])
    expect(readout.keys.map((key) => key.role)).toEqual(["root", "third", "fifth", "seventh"])
    expect(chordFormula("dominant7")).toBe("root, +4, +7, +10")
  })

  it("every chord in every key spans the same intervals", () => {
    for (let sa = 0; sa < 12; sa += 1) {
      for (const name of ["C", "Am", "F", "G", "Dm", "E"]) {
        const readout = chordReadout(parseChord(name)!, sa)
        const [root, third, fifth] = readout.keys
        expect((third!.pitchClass - root!.pitchClass + 12) % 12).toBe(readout.chord.quality === "minor" ? 3 : 4)
        expect((fifth!.pitchClass - root!.pitchClass + 12) % 12).toBe(7)
      }
    }
  })
})

describe("chord keys on the 25-key layout", () => {
  it("presses the chord in the middle octave when it fits", () => {
    // Sa = C, chord C: middle Sa is index 12, so keys 12, 16, 19
    expect(chordKeyIndexes(parseChord("C")!, C)).toEqual([12, 16, 19])
    // Am would need keys 21, 24, 28: past taar Sa, so it drops an octave to 9, 12, 16
    expect(chordKeyIndexes(parseChord("Am")!, C)).toEqual([9, 12, 16])
  })

  it("drops an octave when the top key would pass taar Sa", () => {
    for (let sa = 0; sa < 12; sa += 1) {
      for (const name of ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", "Am", "F#m", "E7"]) {
        const indexes = chordKeyIndexes(parseChord(name)!, sa)
        expect(Math.min(...indexes)).toBeGreaterThanOrEqual(0)
        expect(Math.max(...indexes)).toBeLessThanOrEqual(KEYBOARD_KEY_COUNT - 1)
        // the lowest key is the root
        expect(indexes[0]).toBe(Math.min(...indexes))
      }
    }
  })

  it("keeps the keys of one chord the right number of semitones apart", () => {
    const indexes = chordKeyIndexes(parseChord("Dm")!, D)
    expect(indexes[1]! - indexes[0]!).toBe(3)
    expect(indexes[2]! - indexes[0]!).toBe(7)
  })

  it("a window holds the whole chord", () => {
    for (let sa = 0; sa < 12; sa += 1) {
      for (const name of ["C", "F#", "B", "Am", "E7"]) {
        const indexes = chordKeyIndexes(parseChord(name)!, sa)
        const { start, length } = windowAround(indexes)
        expect(start).toBeGreaterThanOrEqual(0)
        expect(start + length).toBeLessThanOrEqual(KEYBOARD_KEY_COUNT)
        for (const index of indexes) {
          expect(index).toBeGreaterThanOrEqual(start)
          expect(index).toBeLessThan(start + length)
        }
      }
    }
  })
})
