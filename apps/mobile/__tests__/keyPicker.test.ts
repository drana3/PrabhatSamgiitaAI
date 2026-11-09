import { describe, expect, it } from "vitest"

import { keyOptions, keyRailText, keyRows } from "@/lib/kirtan/keyPicker"
import { ROOTS } from "@/lib/songChords/chordName"
import { keyPickerEn, keyPickerEs, keyPickerRu } from "@/locales/keyPicker"

/** The compact key picker (Which key do you play in, Key of this tune, Where does Sa sit): the list rules. */
const OPTIONS = keyOptions(ROOTS)

describe("keyOptions", () => {
  it("lists the twelve roots in the song page's order, one row each", () => {
    expect(OPTIONS.map((o) => o.id)).toEqual([...ROOTS])
    expect(OPTIONS).toHaveLength(12)
  })
})

describe("keyRailText", () => {
  it("shows the chosen note, else the Not sure words, else nothing when the field must have a note", () => {
    expect(keyRailText("D", "Not sure")).toBe("D")
    expect(keyRailText("", "Not sure")).toBe("Not sure")
    expect(keyRailText("", null)).toBeNull()
  })
})

describe("keyRows", () => {
  it("puts Same as previous tune and Not sure first while nothing is typed", () => {
    const rows = keyRows({ options: OPTIONS, query: "", allowNone: true, allowSame: true })
    expect(rows.slice(0, 2).map((r) => r.kind)).toEqual(["same", "none"])
    expect(rows).toHaveLength(14)
  })

  it("offers neither row when the field has no such answer (the chord offer always has a key)", () => {
    const rows = keyRows({ options: OPTIONS, query: "", allowNone: false, allowSame: false })
    expect(rows.every((r) => r.kind === "key")).toBe(true)
  })

  it("filters the notes by what is typed and hides the two special rows", () => {
    const rows = keyRows({ options: OPTIONS, query: "f", allowNone: true, allowSame: true })
    expect(rows.map((r) => (r.kind === "key" ? r.id : r.kind))).toEqual(["F", "F#"])
  })

  it("finds a sharp however the phone keyboard writes it", () => {
    const ids = (q: string) => keyRows({ options: OPTIONS, query: q, allowNone: false, allowSame: false }).map((r) => (r.kind === "key" ? r.id : ""))
    expect(ids("c#")).toEqual(["C#"])
    expect(ids("C ♯")).toEqual(["C#"])
    expect(ids("♭")).toEqual(["Eb", "Ab", "Bb", "B"])
    expect(ids("zz")).toEqual([])
  })
})

describe("the picker's words", () => {
  it("ru and es mirror every English key and none is empty", () => {
    const keys = Object.keys(keyPickerEn).sort()
    expect(Object.keys(keyPickerRu).sort()).toEqual(keys)
    expect(Object.keys(keyPickerEs).sort()).toEqual(keys)
    for (const dict of [keyPickerEn, keyPickerRu, keyPickerEs]) for (const v of Object.values(dict)) expect(v.length).toBeGreaterThan(3)
  })
})
