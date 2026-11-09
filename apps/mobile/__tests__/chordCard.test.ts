import { describe, expect, it } from "vitest"

import { diagramOf, fingeringBass, fingeringPitchClasses, guitarFingering, GUITAR_TUNING } from "@/lib/chordCard/guitar"
import { chordKeys, chordSwaraLine, isWhite, keyWindow, swaraOfKey, whiteKeyCount } from "@/lib/chordCard/keys"
import { chordNoteLine, chordPitchClasses, chordSpec, KIND_INTERVALS, KIND_SUFFIX, type ChordKind } from "@/lib/chordCard/theory"

const KINDS = Object.keys(KIND_SUFFIX) as ChordKind[]
const ROOTS = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]
const PC: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 }
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b)

describe("chord notes (music theory)", () => {
  const cases: Array<[string, string]> = [
    ["C", "C – E – G"],
    ["Am", "A – C – E"],
    ["F#m", "F# – A – C#"],
    ["Bbm", "Bb – Db – F"],
    ["Cm", "C – Eb – G"],
    ["G7", "G – B – D – F"],
    ["Cmaj7", "C – E – G – B"],
    ["Em7", "E – G – B – D"],
    ["Dsus4", "D – G – A"],
    ["Dsus2", "D – E – A"],
    ["Bdim", "B – D – F"],
    ["Caug", "C – E – G#"],
    ["Cadd9", "C – E – G – D"],
    ["Ab", "Ab – C – Eb"],
    ["C#", "C# – E# – G#"],
    ["F", "F – A – C"],
    ["E7", "E – G# – B – D"],
    ["Bb7", "Bb – D – F – Ab"],
    ["Ebmaj7", "Eb – G – Bb – D"],
  ]
  it.each(cases)("%s is %s", (chord, line) => expect(chordNoteLine(chord)).toBe(line))

  it("major is root, +4, +7; minor is root, +3, +7; dominant seventh adds +10; major seventh adds +11", () => {
    expect(KIND_INTERVALS.major.map((i) => i[1])).toEqual([0, 4, 7])
    expect(KIND_INTERVALS.minor.map((i) => i[1])).toEqual([0, 3, 7])
    expect(KIND_INTERVALS.dom7.map((i) => i[1])).toEqual([0, 4, 7, 10])
    expect(KIND_INTERVALS.min7.map((i) => i[1])).toEqual([0, 3, 7, 10])
    expect(KIND_INTERVALS.maj7.map((i) => i[1])).toEqual([0, 4, 7, 11])
    expect(KIND_INTERVALS.sus2.map((i) => i[1])).toEqual([0, 2, 7])
    expect(KIND_INTERVALS.sus4.map((i) => i[1])).toEqual([0, 5, 7])
    expect(KIND_INTERVALS.dim.map((i) => i[1])).toEqual([0, 3, 6])
    expect(KIND_INTERVALS.aug.map((i) => i[1])).toEqual([0, 4, 8])
  })

  it("every root and kind gives the right pitch classes and one letter per degree", () => {
    for (const root of ROOTS) {
      for (const kind of KINDS) {
        const spec = chordSpec(`${root}${KIND_SUFFIX[kind]}`)!
        expect(spec, `${root}${KIND_SUFFIX[kind]}`).not.toBeNull()
        expect(spec.kind).toBe(kind)
        expect(spec.tones.map((t) => t.pitchClass)).toEqual(KIND_INTERVALS[kind].map(([, semis]) => (PC[root]! + semis) % 12))
        // the first tone is the root as written
        expect(spec.tones[0]!.name).toBe(root)
        expect(spec.name).toBe(`${root}${KIND_SUFFIX[kind]}`)
      }
    }
  })

  it("spells a triad with three different letters (no A# and Bb in one chord)", () => {
    for (const root of ROOTS) {
      for (const kind of ["major", "minor", "dim"] as ChordKind[]) {
        const spec = chordSpec(`${root}${KIND_SUFFIX[kind]}`)!
        const letters = spec.tones.map((t) => t.name[0])
        // a double sign falls back to a plain name; every other triad uses three letters a third apart
        if (spec.tones.every((t) => !/##|bb/.test(t.name))) expect(new Set(letters).size).toBe(3)
      }
    }
  })

  it("reads aliases and refuses what it cannot draw", () => {
    expect(chordSpec("Amin")?.name).toBe("Am")
    expect(chordSpec("Fmaj")?.name).toBe("F")
    expect(chordSpec("♭")).toBeNull()
    expect(chordSpec("H")).toBeNull()
    expect(chordSpec("Cfoo")).toBeNull()
    expect(chordSpec("C13")).toBeNull()
    expect(chordSpec("")).toBeNull()
    expect(chordPitchClasses("Cfoo")).toEqual([])
  })

  it("a slash chord keeps its bass", () => {
    const spec = chordSpec("G/B")!
    expect(spec.bass).toBe(11)
    expect(spec.name).toBe("G/B")
    expect(chordPitchClasses("G/B")).toEqual([7, 11, 2])
    expect(chordPitchClasses("C/D")).toEqual([0, 4, 7, 2])
    expect(chordNoteLine("C/D")).toBe("D – C – E – G")
  })
})

describe("guitar fingerings", () => {
  it("plays back exactly the notes of the chord, with the root (or bass) lowest, for every root and kind", () => {
    for (const root of ROOTS) {
      for (const kind of KINDS) {
        const name = `${root}${KIND_SUFFIX[kind]}`
        const fingering = guitarFingering(name)
        expect(fingering, name).not.toBeNull()
        const frets = fingering!.frets
        expect(frets).toHaveLength(6)
        const heard = sorted(fingeringPitchClasses(frets))
        const wanted = chordSpec(name)!
        // nothing foreign is ever sounded; a four-note chord may leave out its fifth (the usual open C7 does), a triad never leaves out anything
        expect(heard.every((pc) => chordPitchClasses(name).includes(pc)), `${name} ${frets.join(",")} foreign note`).toBe(true)
        const need = wanted.tones.filter((t) => wanted.tones.length < 4 || t.role !== "fifth").map((t) => t.pitchClass)
        expect(need.every((pc) => heard.includes(pc)), `${name} ${frets.join(",")} missing note`).toBe(true)
        expect(fingeringBass(frets), `${name} bass`).toBe(PC[root])
        // no fret above the 12th, no gaps of muted strings inside the chord, and a reachable hand (4 frets)
        const pressed = frets.filter((f) => f > 0)
        expect(Math.max(0, ...pressed)).toBeLessThanOrEqual(15)
        if (pressed.length) expect(Math.max(...pressed) - Math.min(...pressed)).toBeLessThanOrEqual(4)
        const played = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0)
        expect(played.length).toBeGreaterThanOrEqual(4)
        expect(played[played.length - 1]! - played[0]! + 1).toBe(played.length)
      }
    }
  })

  it("uses the shapes a guitarist knows", () => {
    expect(guitarFingering("C")!.frets).toEqual([-1, 3, 2, 0, 1, 0])
    expect(guitarFingering("G")!.frets).toEqual([3, 2, 0, 0, 0, 3])
    expect(guitarFingering("Em")!.frets).toEqual([0, 2, 2, 0, 0, 0])
    expect(guitarFingering("F")!.frets).toEqual([1, 3, 3, 2, 1, 1])
    expect(guitarFingering("F")!.barre).toBe(true)
    expect(guitarFingering("Bm")!.frets).toEqual([-1, 2, 4, 4, 3, 2])
    expect(guitarFingering("Am")!.barre).toBe(false)
    expect(guitarFingering("Cfoo")).toBeNull()
  })

  it("a slash chord is drawn as its plain chord", () => {
    expect(guitarFingering("G/B")!.frets).toEqual(guitarFingering("G")!.frets)
  })

  it("the tuning is E A D G B E", () => {
    expect(GUITAR_TUNING.map((n) => n % 12)).toEqual([4, 9, 2, 7, 11, 4])
  })

  it("a diagram starts at the nut for a low shape and at the lowest fret for a high one", () => {
    expect(diagramOf([-1, 3, 2, 0, 1, 0]).baseFret).toBe(1)
    const high = diagramOf([-1, 8, 10, 10, 9, 8])
    expect(high.baseFret).toBe(8)
    expect(high.barre).toEqual({ row: 1, from: 1, to: 5 })
    expect(diagramOf([-1, 0, 2, 2, 2, 0], false).barre).toBeNull()
  })
})

describe("piano and harmonium keys", () => {
  it("C major lights C E G over middle C", () => {
    expect(chordKeys("C").map((k) => k.midi)).toEqual([60, 64, 67])
    expect(chordKeys("C")[0]!.isRoot).toBe(true)
  })
  it("A minor lights A C E", () => {
    expect(chordKeys("Am").map((k) => k.midi)).toEqual([69, 72, 76])
  })
  it("every chord is stacked upwards from the root and has the right notes", () => {
    for (const root of ROOTS) {
      for (const kind of KINDS) {
        const name = `${root}${KIND_SUFFIX[kind]}`
        const keys = chordKeys(name)
        expect(keys.length).toBeGreaterThanOrEqual(3)
        expect(sorted(keys.map((k) => k.midi % 12))).toEqual(sorted(chordPitchClasses(name)))
        expect(keys[0]!.isRoot).toBe(true)
        expect(keys[0]!.midi).toBeGreaterThanOrEqual(60)
        expect(keys[0]!.midi).toBeLessThan(72)
        for (let i = 1; i < keys.length; i += 1) expect(keys[i]!.midi).toBeGreaterThan(keys[i - 1]!.midi)
        // the keys fit the window, which is at least ten white keys wide
        const window = keyWindow(keys)
        expect(keys.every((k) => k.midi >= window.start && k.midi <= window.end)).toBe(true)
        expect(isWhite(window.start) && isWhite(window.end)).toBe(true)
        expect(whiteKeyCount(window)).toBeGreaterThanOrEqual(10)
      }
    }
  })
  it("the black keys are C# D# F# G# A#", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((n) => !isWhite(n))).toEqual([1, 3, 6, 8, 10])
  })
  it("a slash chord adds its bass an octave down", () => {
    const keys = chordKeys("G/B")
    expect(keys[0]).toMatchObject({ midi: 59, isBass: true })
    expect(keys.map((k) => k.midi)).toEqual([59, 67, 71, 74])
  })
  it("the harmonium says the swara of each key for the Sa in use", () => {
    expect(chordSwaraLine("C", 0)).toBe("Sa Ga Pa")
    expect(chordSwaraLine("Am", 0)).toBe("Dha Sa Ga")
    expect(chordSwaraLine("D", 2)).toBe("Sa Ga Pa")
    expect(chordSwaraLine("Dm", 2)).toBe("Sa ga Pa")
    expect(swaraOfKey(61, 0)).toBe("re")
  })
})
