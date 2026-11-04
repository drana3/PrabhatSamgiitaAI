import { describe, expect, it } from "vitest"

import {
  explainChord,
  explainerTokens,
  hitSpKey,
  keyInChord,
  pitchOfKeyId,
  spKeys,
  swaraOfPitch,
  whiteRects,
} from "@/lib/songPage/spKeyboard"

describe("harmonium keyboard of the prototype", () => {
  it("prints the swara of each key for Sa on D", () => {
    const { whites, blacks } = spKeys(2)
    expect(whites.map((k) => k.swara)).toEqual(["ni", "Sa", "Re", "ga", "Ma", "Pa", "Dha", "ni"])
    expect(whites.filter((k) => k.isSa).map((k) => k.note)).toEqual(["D"])
    expect(blacks.map((k) => k.note)).toEqual(["C#", "Eb", "F#", "Ab", "Bb"])
  })

  it("marks Sa on both C keys when Sa is C", () => {
    const { whites } = spKeys(0)
    expect(whites[0]!.isSa && whites[7]!.isSa).toBe(true)
    expect(whites[7]!.western).toBe("C5")
    expect(whites[0]!.western).toBe("C4")
  })

  it("places the black keys like the prototype", () => {
    expect(spKeys(0).blacks.map((k) => k.leftPct)).toEqual([8.25, 20.75, 45.75, 58.25, 70.75])
  })

  it("gives the Sa key the extra width the prototype shows", () => {
    const rects = whiteRects(370, [false, true, false, false, false, false, false, false])
    expect(rects.map((r) => Math.round(r.w))).toEqual([42, 62, 42, 42, 42, 42, 42, 42])
    expect(rects[7]!.x + rects[7]!.w).toBeCloseTo(370, 5)
    // the touch between D and E lands on the wider D key
    expect(hitSpKey(rects[1]!.x + 60, 200, 370, [false, true, false, false, false, false, false, false])).toBe("w1")
  })

  it("names the swara of a pitch for the chosen Sa", () => {
    expect(swaraOfPitch(6, 0)).toBe("Ma♯")
    expect(swaraOfPitch(7, 2)).toBe("Ma")
  })

  it("finds the key under a point, black keys first", () => {
    const sa = spKeys(2).whites.map((k) => k.isSa)
    expect(hitSpKey(5, 200, 390, sa)).toBe("w0")
    expect(hitSpKey(385, 200, 390, sa)).toBe("w7")
    expect(hitSpKey(41, 60, 390, sa)).toBe("b0")
    expect(hitSpKey(41, 180, 390, sa)).toBe("w0")
    expect(hitSpKey(41, 400, 390, sa)).toBeNull()
    expect(pitchOfKeyId("b2")).toBe(6)
    expect(pitchOfKeyId("w7")).toBe(12)
  })
})

describe("chord explainer of the prototype", () => {
  it("explains Am for Sa on C as three keys", () => {
    const am = explainChord("Am", 0)
    expect(am.name).toBe("Am")
    expect(am.pitches).toEqual([9, 0, 4])
    expect(am.kind).toBe("Minor: root, then 3 and 7 keys up")
    expect(am.equation).toBe("Am = A + C + E, swaras Dha · Sa · Ga")
  })

  it("moves the chord with Sa", () => {
    const f = explainChord("F", 2)
    expect(f.name).toBe("G")
    expect(f.pitches).toEqual([7, 11, 2])
    expect(f.kind).toBe("Major: root, then 4 and 7 keys up")
  })

  it("lights the keys of the chord, the high C with the low one", () => {
    const am = explainChord("Am", 0)
    const { whites } = spKeys(0)
    expect(whites.filter((k) => keyInChord(k, am)).map((k) => k.note + k.pitch)).toEqual(["C0", "E4", "A9", "C12"])
  })

  it("builds the song example with a chord on the first and middle word", () => {
    const tokens = explainerTokens([["a", "b", "c", "d"], ["e", "f", "g", "h", "i"]], 0)
    expect(tokens.filter((t) => t.chord).map((t) => `${t.word}:${t.chord}`)).toEqual(["a:C", "c:Am", "e:Am", "h:F"])
    expect(tokens.filter((t) => t.lineBreak)).toHaveLength(2)
    expect(tokens[0]!.swara).toBe("Sa")
  })
})
