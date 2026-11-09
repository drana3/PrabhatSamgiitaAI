import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { choiceLabel, choiceRailText, choiceRows, pickChoice, rowIsOn, type ChoiceOption } from "@/lib/kirtan/choiceField"
import { kindHasPerformance, kindHasRecordingType, kindHasTempo, kindRequiresPerformance, kindRequiresRecordingType, PERFORMANCES, recordingTypesFor, TEMPO_IDS } from "@/lib/kirtan/recordingInfo"
import { DANCES } from "@/lib/kirtan/types"
import { choiceFieldEn, choiceFieldEs, choiceFieldRu } from "@/locales/choiceField"

/**
 * The compact choice row (Dada, 10 Nov 2026): Solo or group, How was it recorded, Tempo and Which dance are ONE row with a sheet, not a
 * row of big chips. The rules are pure (lib/kirtan/choiceField.ts); the wiring is checked in the source, and the sheet itself was opened
 * in the browser (docs/layout-rules.md, "One row, a sheet").
 */
const ROOT = join(__dirname, "..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

const SOLO_GROUP: ChoiceOption[] = PERFORMANCES.map((id) => ({ id, label: id === "solo" ? "Solo" : "Group or choir" }))
const TEMPO: ChoiceOption[] = TEMPO_IDS.map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) }))
const NONE = "Not chosen"

describe("the value the row shows", () => {
  it("shows the words of the chosen option, else Not chosen", () => {
    expect(choiceRailText(SOLO_GROUP, "group", NONE)).toBe("Group or choir")
    expect(choiceRailText(SOLO_GROUP, "solo", NONE)).toBe("Solo")
    expect(choiceRailText(SOLO_GROUP, null, NONE)).toBe(NONE)
    expect(choiceRailText(SOLO_GROUP, "", NONE)).toBe(NONE)
    expect(choiceRailText(SOLO_GROUP, undefined, NONE)).toBe(NONE)
  })

  it("an id that is no longer offered reads as nothing chosen instead of showing a raw id", () => {
    expect(choiceLabel(SOLO_GROUP, "duet")).toBeNull()
    expect(choiceRailText(SOLO_GROUP, "duet", NONE)).toBe(NONE)
  })
})

describe("the rows of the sheet", () => {
  it("an optional field starts with Not chosen, then every option in its own order", () => {
    expect(choiceRows(TEMPO, true).map((r) => (r.kind === "none" ? "none" : r.id))).toEqual(["none", "slow", "medium", "fast", "mix"])
  })

  it("a required field has no Not chosen row, so it can never be emptied", () => {
    const rows = choiceRows(SOLO_GROUP, false)
    expect(rows.map((r) => r.kind)).toEqual(["choice", "choice"])
    expect(rows.map((r) => (r.kind === "choice" ? r.id : ""))).toEqual(["solo", "group"])
  })

  it("ticks the chosen option, and Not chosen while nothing is chosen", () => {
    const rows = choiceRows(TEMPO, true)
    expect(rows.map((r) => rowIsOn(r, "fast"))).toEqual([false, false, false, true, false])
    expect(rows.map((r) => rowIsOn(r, null))).toEqual([true, false, false, false, false])
  })
})

describe("what a tap does", () => {
  it("picks an option", () => {
    expect(pickChoice(null, "solo", true)).toEqual({ value: "solo", changed: true })
    expect(pickChoice("solo", "group", true)).toEqual({ value: "group", changed: true })
  })

  it("picking what is already chosen changes nothing (the sheet only closes)", () => {
    expect(pickChoice("solo", "solo", true)).toEqual({ value: "solo", changed: false })
    expect(pickChoice("fast", "fast", false)).toEqual({ value: "fast", changed: false })
  })

  it("an optional field is cleared by Not chosen", () => {
    expect(pickChoice("fast", null, false)).toEqual({ value: null, changed: true })
    expect(pickChoice(null, null, false)).toEqual({ value: null, changed: false })
  })

  it("a required field ignores Not chosen", () => {
    expect(pickChoice("solo", null, true)).toEqual({ value: "solo", changed: false })
  })
})

describe("the options are the app's own lists, unchanged", () => {
  it("Solo or group is required for a Kiirtan only, and its two ids are the API's", () => {
    expect(PERFORMANCES).toEqual(["solo", "group"])
    expect(kindRequiresPerformance("kiirtan")).toBe(true)
    expect(kindRequiresPerformance("bhajan")).toBe(false)
    expect(kindHasPerformance("bhajan")).toBe(true)
  })

  it("How was it recorded offers studio, live and AI to every kind that asks, and requires it of a Kiirtan only", () => {
    for (const kind of ["kiirtan", "bhajan", "dance_song", "spiritual_song", "prabhat_samgiita"]) {
      expect(kindHasRecordingType(kind)).toBe(true)
      expect(recordingTypesFor(kind)).toEqual(["studio", "live", "ai"])
    }
    expect(kindRequiresRecordingType("kiirtan")).toBe(true)
    expect(kindRequiresRecordingType("bhajan")).toBe(false)
  })

  it("Tempo is Dance music only: slow, medium, fast, mix", () => {
    expect(TEMPO_IDS).toEqual(["slow", "medium", "fast", "mix"])
    expect(kindHasTempo("dance_song")).toBe(true)
    expect(kindHasTempo("kiirtan")).toBe(false)
    expect(kindHasTempo("bhajan")).toBe(false)
  })

  it("the dances are Tandava and Kaoshiki", () => {
    expect([...DANCES]).toEqual(["tandava", "kaoshiki"])
  })
})

describe("the wiring: no row of big chips is left in the form", () => {
  const sound = read("components/kirtan/add/SoundFields.tsx")
  const type = read("components/kirtan/add/RecordingTypeField.tsx")
  const field = read("components/kirtan/add/ChoiceField.tsx")

  it("Solo or group, Tempo and Which dance use the one-row ChoiceField", () => {
    expect(sound).toContain("<ChoiceField")
    expect(sound).not.toContain("ChoiceChip")
    expect(sound).not.toMatch(/flexWrap/)
    for (const id of ["performance-field", "tempo-field", "dance-field"]) expect(sound).toContain(`testID="${id}"`)
  })

  it("How was it recorded uses it too, and keeps the AI note", () => {
    expect(type).toContain("<ChoiceField")
    expect(type).not.toMatch(/flexWrap/)
    expect(type).toContain("recinfo.type.aiNote")
    expect(type).toContain('testID="recording-type-field"')
  })

  it("the row keeps the Required / Optional mark, the error line, the danger border and the screen-reader words", () => {
    expect(field).toContain("RequiredMark")
    expect(field).toContain("FieldError")
    expect(field).toContain("amColors.danger")
    expect(field).toContain('t("picker.open"')
    expect(field).toContain("expanded: open")
    expect(field).toContain("<SpringSheet")
  })

  it("the validation names (the scroll targets of the errors) are still on the screens", () => {
    for (const file of ["app/add-kirtan.tsx", "app/upload-set.tsx"]) {
      const source = read(file)
      for (const name of ["performance", "recordingType"]) expect(source).toContain(`form.field("${name}")`)
    }
    expect(read("app/add-kirtan.tsx")).toContain('form.field("dance")')
    expect(read("app/upload-set.tsx")).toContain('form.field("dance")')
  })

  it("the form's Dance field is the dropdown; the small chips stay only in the rows of the bulk queue", () => {
    expect(read("components/kirtan/add/KindFields.tsx")).not.toMatch(/export function DanceField/)
    expect(read("app/add-kirtan.tsx")).toContain('{ DanceField, PerformanceField, TempoField } from "@/components/kirtan/add/SoundFields"')
    expect(read("components/kirtan/add/QueueRows.tsx")).toContain("DanceChoices")
  })
})

describe("the row's words", () => {
  it("ru and es mirror every English key and none is empty", () => {
    const keys = Object.keys(choiceFieldEn).sort()
    expect(Object.keys(choiceFieldRu).sort()).toEqual(keys)
    expect(Object.keys(choiceFieldEs).sort()).toEqual(keys)
    for (const dict of [choiceFieldEn, choiceFieldRu, choiceFieldEs]) for (const v of Object.values(dict)) expect(v.length).toBeGreaterThan(3)
    for (const dict of [choiceFieldRu, choiceFieldEs]) expect(dict["choice.clear.a11y"]).toContain("{field}")
  })
})
