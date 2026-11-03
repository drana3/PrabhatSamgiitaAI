import { describe, expect, it } from "vitest"

import {
  barreCount,
  bestCapo,
  capoLabel,
  capoNote,
  clampCapo,
  diagramModel,
  fingeringFor,
  harmoniumShift,
  isOpenShape,
  parseChord,
  shapeChord,
  soundingChord,
  stepHarmoniumKey,
  swaraNotes,
  transposeChord,
} from "@/lib/songPage/chords"

describe("chord parsing and transposing", () => {
  it("reads root, quality and bass", () => {
    expect(parseChord("F#m7")).toMatchObject({ root: 6, suffix: "m7", bass: null })
    expect(parseChord("D/F#")).toMatchObject({ root: 2, suffix: "", bass: 6 })
    expect(parseChord("Bb")).toMatchObject({ root: 10, flat: true })
    expect(parseChord("H")).toBeNull()
  })

  it("transposes in both directions and wraps", () => {
    expect(transposeChord("C", 2)).toBe("D")
    expect(transposeChord("Am", 3)).toBe("Cm")
    expect(transposeChord("B", 1)).toBe("C")
    expect(transposeChord("C", -1)).toBe("B")
    expect(transposeChord("G", 12)).toBe("G")
    expect(transposeChord("D/F#", 2)).toBe("E/G#")
  })

  it("keeps flat spelling when the chord came in flat", () => {
    expect(transposeChord("Bb", 2)).toBe("C")
    expect(transposeChord("Eb", 1)).toBe("E")
    expect(transposeChord("C", 1, "flat")).toBe("Db")
    expect(transposeChord("Bb", 3)).toBe("Db")
  })

  it("leaves unreadable names alone", () => {
    expect(transposeChord("N.C.", 3)).toBe("N.C.")
  })
})

describe("capo", () => {
  it("shape root is sounding root minus capo (spec example)", () => {
    const sounding = ["C", "Am", "F", "G"]
    expect(sounding.map((c) => shapeChord(c, 5))).toEqual(["G", "Em", "C", "D"])
  })

  it("sounding is the shape raised by the capo", () => {
    expect(["G", "Em", "C", "D"].map((c) => soundingChord(c, 5))).toEqual(["C", "Am", "F", "G"])
  })

  it("capo 0 changes nothing, and capo is clamped to 0..7", () => {
    expect(shapeChord("F", 0)).toBe("F")
    expect(clampCapo(9)).toBe(7)
    expect(clampCapo(-2)).toBe(0)
    expect(clampCapo(Number.NaN)).toBe(0)
    expect(shapeChord("G", 99)).toBe(shapeChord("G", 7))
  })

  it("labels", () => {
    expect(capoLabel(0)).toBe("Off")
    expect(capoLabel(5)).toBe("Capo 5")
    expect(capoNote(5)).toBe("Capo on fret 5")
    expect(capoNote(0)).toBe("")
  })
})

describe("barre counting and best capo", () => {
  it("knows open and barre shapes", () => {
    expect(isOpenShape("G")).toBe(true)
    expect(isOpenShape("Em")).toBe(true)
    expect(isOpenShape("F")).toBe(false)
    expect(isOpenShape("Bm")).toBe(false)
    expect(isOpenShape("F#m")).toBe(false)
    expect(isOpenShape("Xyz")).toBe(false)
    expect(barreCount(["C", "F", "F", "Bm"])).toBe(2)
  })

  it("picks capo 5 for C Am F G, all open (spec example)", () => {
    expect(bestCapo(["C", "Am", "F", "G"])).toBe(5)
  })

  it("picks capo 0 when the song already uses open shapes", () => {
    expect(bestCapo(["G", "Em", "C", "D"])).toBe(0)
  })

  it("returns 0 for no chords", () => {
    expect(bestCapo([])).toBe(0)
  })

  it("never returns more than 7", () => {
    expect(bestCapo(["F#m", "B", "C#m", "E"])).toBeLessThanOrEqual(7)
  })
})

describe("fingerings and diagrams", () => {
  it("finds a fingering for flat and sharp spellings", () => {
    expect(fingeringFor("C")).toBe("x32010")
    expect(fingeringFor("Bb")).toBe(fingeringFor("A#"))
    expect(fingeringFor("Q")).toBeNull()
    expect(fingeringFor("D/F#")).toBeNull()
  })

  it("models an open chord with no barre", () => {
    const model = diagramModel("x32010")!
    expect(model.baseFret).toBe(1)
    expect(model.muted).toEqual([0])
    expect(model.open).toEqual([3, 5])
    expect(model.barre).toBeNull()
    expect(model.dots).toHaveLength(3)
  })

  it("finds the barre of F and of Bm", () => {
    expect(diagramModel("133211")!.barre).toEqual({ fret: 1, from: 0, to: 5 })
    const bm = diagramModel("x24432")!
    expect(bm.baseFret).toBe(1)
    expect(bm.barre).toEqual({ fret: 2, from: 1, to: 5 })
    // a high shape scrolls the board so its lowest fret sits at the top
    const ab = diagramModel("466544")!
    expect(ab.baseFret).toBe(4)
    expect(ab.barre).toEqual({ fret: 1, from: 0, to: 5 })
  })

  it("rejects a malformed fingering", () => {
    expect(diagramModel("x320")).toBeNull()
  })
})

describe("harmonium", () => {
  it("maps swaras to note names: Sa = D gives D E F# G A B C#", () => {
    expect(swaraNotes("D").map((s) => s.note)).toEqual(["D", "E", "F#", "G", "A", "B", "C#"])
    expect(swaraNotes("D").map((s) => s.swara)).toEqual(["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"])
  })

  it("spells flat keys with flats and avoids E# and double sharps", () => {
    expect(swaraNotes("F").map((s) => s.note)).toEqual(["F", "G", "A", "Bb", "C", "D", "E"])
    const csharp = swaraNotes("C#").map((s) => s.note)
    expect(csharp.every((n) => !n.includes("##") && !["E#", "B#"].includes(n))).toBe(true)
  })

  it("steps the key inside C to G and stops at the ends", () => {
    expect(stepHarmoniumKey("D", 1)).toBe("D#")
    expect(stepHarmoniumKey("C", -1)).toBe("C")
    expect(stepHarmoniumKey("G", 1)).toBe("G")
  })

  it("shifts the chart to the chosen Sa", () => {
    expect(harmoniumShift("C", "D")).toBe(2)
    expect(harmoniumShift("D", "C")).toBe(10)
    expect(harmoniumShift(undefined, "E")).toBe(0)
  })
})
