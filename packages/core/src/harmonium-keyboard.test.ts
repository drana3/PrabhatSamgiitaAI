import { describe, expect, it } from "vitest"

import {
  harmoniumKeyboardLayout,
  keyboardIndexForShortcut,
  parseSargamInput,
  sargamPlayEvents,
  semitonesToWestern,
  swaraToWestern,
} from "./harmonium-keyboard"

describe("harmonium-keyboard", () => {
  it("builds an eight-key shuddha layout from tonic", () => {
    const keys = harmoniumKeyboardLayout("C")
    expect(keys).toHaveLength(8)
    expect(keys[0]?.western).toBe("C4")
    expect(keys[7]?.western).toBe("C5")
    expect(keys[0]?.devanagari).toBe("सा")
  })

  it("shifts layout when Sa tonic changes", () => {
    const keys = harmoniumKeyboardLayout("G")
    expect(keys[0]?.western).toBe("G4")
    expect(keys[4]?.western).toBe("D5")
  })

  it("parses Latin and Devanagari sargam", () => {
    const latin = parseSargamInput("Sa Re Ga Ma Pa Dha Ni Sa'", "C")
    expect(latin.map((item) => item.token)).toEqual(["S", "R", "G", "m", "P", "D", "N", "S"])
    expect(latin[7]?.western).toBe("C5")

    const hindi = parseSargamInput("सा रे ग म प ध नि सां", "C")
    expect(hindi).toHaveLength(8)
    expect(hindi[0]?.western).toBe("C4")
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

  it("maps keyboard shortcuts like common piano apps", () => {
    expect(keyboardIndexForShortcut("z")).toBe(0)
    expect(keyboardIndexForShortcut("X")).toBe(1)
    expect(semitonesToWestern("C", 0)).toBe("C4")
  })
})
