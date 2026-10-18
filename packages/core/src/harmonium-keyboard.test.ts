import { describe, expect, it } from "vitest"

import {
  harmoniumKeyboardLayout,
  keyboardIndexForShortcut,
  keyboardIndexForWestern,
  parseSargamInput,
  parseSargamPlayBeats,
  playBeatsToEvents,
  sargamPlayEvents,
  semitonesToWestern,
  shiftWesternPitch,
  swaraToWestern,
} from "./harmonium-keyboard"

describe("harmonium-keyboard", () => {
  it("builds a 2-octave chromatic harmonium starting at mandra Sa", () => {
    const keys = harmoniumKeyboardLayout("C")
    expect(keys).toHaveLength(25)
    expect(keys.filter((key) => !key.isBlack)).toHaveLength(15)
    expect(keys.filter((key) => key.isBlack)).toHaveLength(10)
    expect(keys[0]?.western).toBe("C3")
    expect(keys[0]?.latin).toBe(".Sa")
    expect(keys[0]?.devanagari).toBe(".सा")
    expect(keys[24]?.western).toBe("C5")
    const middleSa = keys.find((key) => key.western === "C4")
    expect(middleSa?.isSa).toBe(true)
    expect(middleSa?.devanagari).toBe("सा")
    expect(keys.find((key) => key.western === "C#4")?.token).toBe("r")
  })

  it("keeps the leftmost key as mandra Sa when the tonic moves", () => {
    const keys = harmoniumKeyboardLayout("G")
    expect(keys[0]?.western).toBe("G3")
    expect(keys[0]?.latin).toBe(".Sa")
    expect(keys.find((key) => key.western === "G4")?.isSa).toBe(true)
    expect(keys.find((key) => key.western === "G4")?.latin).toBe("Sa")
    expect(keys.find((key) => key.western === "A4")?.latin).toBe("Re")
  })

  it("parses Latin and Devanagari sargam", () => {
    const latin = parseSargamInput("Sa Re Ga Ma Pa Dha Ni Sa'", "C")
    expect(latin.map((item) => item.token)).toEqual(["S", "R", "G", "m", "P", "D", "N", "S"])
    expect(latin[7]?.western).toBe("C5")

    const hindi = parseSargamInput("सा रे ग म प ध नि सां", "C")
    expect(hindi).toHaveLength(8)
    expect(hindi[0]?.western).toBe("C4")

    const mandra = parseSargamInput(".P S .N", "C")
    expect(mandra.map((item) => item.western)).toEqual(["G3", "C4", "B3"])

    expect(parseSargamInput("नी", "C")[0]?.token).toBe("N")
    expect(parseSargamInput("ग़", "C")[0]?.token).toBe("g")
    expect(parseSargamInput("ध़", "C")[0]?.token).toBe("d")

    const glued = parseSargamInput(".पसासासा सारे.नी.ध .नीरे रेमगम", "C")
    expect(glued.map((item) => item.token)).toEqual(["P", "S", "S", "S", "S", "R", "N", "D", "N", "R", "R", "m", "G", "m"])
    expect(glued[0]?.octave).toBe("lower")
    expect(glued[6]?.octave).toBe("lower")
  })

  it("supports komal and tivra OCR tokens", () => {
    expect(swaraToWestern("C", "r")).toBe("C#4")
    expect(swaraToWestern("C", "M")).toBe("F#4")
  })

  it("creates timed play events for typed sargam", () => {
    const beatSec = 0.6
    const gapSec = 0.048
    const events = sargamPlayEvents("C", "Sa Re Ga", beatSec, gapSec)
    expect(events).toHaveLength(3)
    expect(events[0]?.startSec).toBe(0)
    expect(events[1]?.startSec).toBeCloseTo(beatSec, 5)
    expect(events[0]?.durationSec).toBeCloseTo(beatSec - gapSec * 0.35, 5)
    expect(events[0]?.western).toBe("C4")
    expect(events[1]?.western).toBe("D4")
  })

  it("re-strikes repeated swaras; --- holds key for 1s per dash; á/a' add matras", () => {
    const beatSec = 0.6
    const gapSec = 0.048
    const repeated = sargamPlayEvents("C", "Pa Pa Pa", beatSec, gapSec)
    expect(repeated).toHaveLength(3)
    expect(repeated.every((event) => event.western === "G4")).toBe(true)
    expect(repeated[1]?.startSec).toBeCloseTo(beatSec, 5)
    expect(repeated[2]?.startSec).toBeCloseTo(beatSec * 2, 5)

    const paused = sargamPlayEvents("C", "Pa --- Pa Pa", beatSec, gapSec)
    expect(paused).toHaveLength(3)
    expect(paused[0]?.durationSec).toBeCloseTo(beatSec + 3 - gapSec * 0.35 * 0.35, 5)
    expect(paused[1]?.startSec).toBeCloseTo(beatSec + 3, 5)
    expect(paused[2]?.startSec).toBeCloseTo(beatSec * 2 + 3, 5)

    const held = sargamPlayEvents("C", "Sa á á á", beatSec, gapSec)
    expect(held).toHaveLength(1)
    expect(held[0]?.durationSec).toBeCloseTo(4 * beatSec + beatSec * 0.45, 5)
  })

  it("matches Play on keys beat timing for typed sargam", () => {
    const beatSec = 0.6
    const gapSec = 0.048
    const beats = [{ sargam: "G", beats: 4 }]
    const expected = playBeatsToEvents("C", beats, beatSec, gapSec)
    const typed = sargamPlayEvents("C", "Ga á á á", beatSec, gapSec)
    expect(typed).toEqual(expected)
  })

  it("maps laptop keys like web-harmonium notes (E=Sa, R=Re)", () => {
    const keys = harmoniumKeyboardLayout("C")
    expect(keyboardIndexForShortcut("z")).toBe(0)
    expect(keys[keyboardIndexForShortcut("e")]?.western).toBe("C4")
    expect(keys[keyboardIndexForShortcut("r")]?.western).toBe("D4")
    expect(keys[keyboardIndexForShortcut("4")]?.western).toBe("C#4")
    expect(keys[keyboardIndexForShortcut("p")]?.western).toBe("C5")
    expect(semitonesToWestern("C", 0)).toBe("C4")
  })

  it("parses accented booklet Latin and bar typos for typed playback", () => {
    expect(parseSargamInput("Sá'", "C")[0]).toMatchObject({ token: "S", octave: "upper", western: "C5" })
    expect(parseSargamInput("gá", "C")[0]).toMatchObject({ token: "g", octave: "middle", western: "D#4" })
    expect(parseSargamInput("ga", "C")[0]).toMatchObject({ token: "g", octave: "middle", western: "D#4" })

    const line = "Sá' gá á sá | gá' má gá rá I ga má' gá' rá | sá' ná' dhá á"
    expect(parseSargamInput(line, "C").map((item) => item.western)).toEqual([
      "C5",
      "D#5",
      "C5",
      "D#5",
      "F5",
      "D#5",
      "C#5",
      "D#5",
      "F5",
      "D#5",
      "C#5",
      "C5",
      "A#5",
      "G#5",
    ])
  })

  it("matches PDF booklet ASCII line for typed playback", () => {
    const accented =
      "Sá' gá á sá | gá' má gá rá I ga má' gá' rá | sá' ná' dhá á"
    const pdf = "Sa' ga' a' sa' | ga' ma' ga' ra' I ga' ma' ga' ra' | sa' na' dha' a' I"
    expect(parseSargamInput(accented, "C").map((item) => item.western)).toEqual(
      parseSargamInput(pdf, "C").map((item) => item.western),
    )
    expect(parseSargamPlayBeats(accented, "C").reduce((sum, beat) => sum + beat.beats, 0)).toBe(16)
    expect(parseSargamPlayBeats(pdf, "C").reduce((sum, beat) => sum + beat.beats, 0)).toBe(16)
    const beatSec = 0.6
    const line = "Sa' ga' a' sa' | ga' ma' ga' ra' I ga' ma' ga' ra' | sa' na' dha' a' I"
    const beats = parseSargamPlayBeats(line, "C")
    expect(beats.find((beat) => beat.western === "D#5")?.beats).toBe(2)
    expect(beats.find((beat) => beat.western === "G#5" && beat.beats === 2)).toBeTruthy()
    expect(beats.reduce((sum, beat) => sum + beat.beats, 0)).toBe(16)
    const events = sargamPlayEvents("C", line, beatSec, beatSec * 0.08)
    expect(events.at(-1)?.startSec).toBeCloseTo(14 * beatSec, 5)
  })

  it("shifts pitch for bass, male, female, and high registers", () => {
    expect(shiftWesternPitch("C4", -12)).toBe("C3")
    expect(shiftWesternPitch("C4", 0)).toBe("C4")
    expect(shiftWesternPitch("C4", 7)).toBe("G4")
    expect(shiftWesternPitch("C4", 12)).toBe("C5")
  })
})
