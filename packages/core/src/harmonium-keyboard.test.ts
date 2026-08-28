import { describe, expect, it } from "vitest"

import {
  harmoniumKeyboardLayout,
  keyboardIndexForShortcut,
  keyboardIndexForWestern,
  parseSargamInput,
  sampleSongLineEvents,
  sampleSongPlayEvents,
  sampleSongTiming,
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
    const events = sargamPlayEvents("C", "Sa Re Ga", 0.4, 0.1)
    expect(events).toHaveLength(3)
    expect(events[0]?.startSec).toBe(0)
    expect(events[1]?.startSec).toBeCloseTo(0.5, 5)
    expect(events[0]?.western).toBe("C4")
    expect(events[1]?.western).toBe("D4")
  })

  it("holds repeated swaras as one note instead of re-striking", () => {
    const events = sargamPlayEvents("C", "S S S S", 0.4, 0.05)
    expect(events).toHaveLength(1)
    expect(events[0]?.western).toBe("C4")
    expect(events[0]?.durationSec).toBeCloseTo(0.4 + 3 * 0.45, 5)
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

  it("shifts pitch for bass, male, female, and high registers", () => {
    expect(shiftWesternPitch("C4", -12)).toBe("C3")
    expect(shiftWesternPitch("C4", 0)).toBe("C4")
    expect(shiftWesternPitch("C4", 7)).toBe("G4")
    expect(shiftWesternPitch("C4", 12)).toBe("C5")
  })
})
