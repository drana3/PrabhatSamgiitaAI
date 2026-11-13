import { describe, expect, it } from "vitest"

import { addOwnTag, canAddOwn, chipsOf, filterOptions, fitRailChips, NO_TAGS, OWN_TAGS_MAX, removeOwnTag, tagCount, TAGS_MAX, toggleTag, type TagValue } from "@/lib/kirtan/tags"
import { FORM_INSTRUMENT_IDS, formInstrumentChoices, INSTRUMENT_IDS } from "@/lib/kirtan/instruments"
import { STYLES } from "@/lib/kirtan/styles"

/** The rules of the compact tag picker (Style, Mood, main instrument). The numbers are the API's (recording_tags.py). */

const OPTIONS = [
  { id: "indian", label: "Indian style" },
  { id: "electronic", label: "Electronic" },
  { id: "acoustic_guitar", label: "Acoustic guitar" },
]
const listedFor = (word: string) => OPTIONS.find((o) => o.label.toLowerCase() === word.toLowerCase())?.id ?? null

describe("tags", () => {
  it("a listed id goes on and off, in the order chosen", () => {
    let value: TagValue = NO_TAGS
    value = toggleTag(value, "electronic").value
    value = toggleTag(value, "indian").value
    expect(value.ids).toEqual(["electronic", "indian"])
    value = toggleTag(value, "electronic").value
    expect(value.ids).toEqual(["indian"])
  })

  it("is full at five tags, listed and own together, and says why instead of changing", () => {
    expect(TAGS_MAX).toBe(5)
    expect(OWN_TAGS_MAX).toBe(2)
    const full: TagValue = { ids: ["a", "b", "c", "d"], own: ["Baul"] }
    expect(tagCount(full)).toBe(5)
    expect(toggleTag(full, "e")).toEqual({ value: full, problem: "full" })
    expect(toggleTag(full, "a").problem).toBeNull() // taking one off is always allowed
    expect(addOwnTag(full, "Kirtan folk")).toEqual({ value: full, problem: "full" })
    // a single-choice field (the main instrument) is full at one
    expect(toggleTag({ ids: ["piano"], own: [] }, "guitar", 1).problem).toBe("full")
  })

  it("an own word is cleaned, kept once whatever its case, and limited to two", () => {
    let value: TagValue = NO_TAGS
    value = addOwnTag(value, "  Baul   style ").value
    expect(value.own).toEqual(["Baul style"])
    expect(addOwnTag(value, "BAUL STYLE")).toEqual({ value, problem: null })
    value = addOwnTag(value, "Bossa nova").value
    expect(value.own).toEqual(["Baul style", "Bossa nova"])
    expect(addOwnTag(value, "Jazz")).toEqual({ value, problem: "ownFull" })
    expect(removeOwnTag(value, "Baul style").own).toEqual(["Bossa nova"])
  })

  it("an own word under two letters is refused, and a word that IS a listed one turns that one on", () => {
    expect(addOwnTag(NO_TAGS, "x")).toEqual({ value: NO_TAGS, problem: "short" })
    expect(addOwnTag(NO_TAGS, "  ")).toEqual({ value: NO_TAGS, problem: "short" })
    const listed = addOwnTag(NO_TAGS, "electronic", { listedFor })
    expect(listed.value).toEqual({ ids: ["electronic"], own: [] })
    // already on: nothing changes, nobody is told off
    expect(addOwnTag(listed.value, "Electronic", { listedFor })).toEqual({ value: listed.value, problem: null })
  })

  it("shows the listed chips as chosen, then the own words", () => {
    const chips = chipsOf({ ids: ["electronic", "indian"], own: ["Baul"] }, (id) => OPTIONS.find((o) => o.id === id)?.label ?? id)
    expect(chips.map((c) => c.label)).toEqual(["Electronic", "Indian style", "Baul"])
    expect(chips.map((c) => c.own)).toEqual([false, false, true])
    expect(new Set(chips.map((c) => c.key)).size).toBe(3)
  })

  it("searches by label or id, ignoring case and accents; an empty search shows everything", () => {
    expect(filterOptions(OPTIONS, "").length).toBe(3)
    expect(filterOptions(OPTIONS, "ELEC").map((o) => o.id)).toEqual(["electronic"])
    expect(filterOptions(OPTIONS, "guitar").map((o) => o.id)).toEqual(["acoustic_guitar"])
    expect(filterOptions(OPTIONS, "acoustic guitar").map((o) => o.id)).toEqual(["acoustic_guitar"])
    expect(filterOptions(OPTIONS, "zzz")).toEqual([])
  })

  it("offers 'Add your own' only for a word that is not already a row", () => {
    expect(canAddOwn("", OPTIONS)).toBe(false)
    expect(canAddOwn("Electronic", OPTIONS)).toBe(false)
    expect(canAddOwn("Electro-swing", OPTIONS)).toBe(true)
  })
})

describe("the main instrument's list on the form", () => {
  it("offers all sixteen instruments in the sheet, in the API's order; own words are added inside the sheet", () => {
    expect([...FORM_INSTRUMENT_IDS]).toEqual([...INSTRUMENT_IDS])
    expect(formInstrumentChoices()).toHaveLength(16)
    expect(formInstrumentChoices().map((c) => c.id)).toEqual([...INSTRUMENT_IDS])
    expect(formInstrumentChoices().find((c) => c.id === "voice_only")!.label).toBe("Voice only (a cappella)")
    expect(formInstrumentChoices().find((c) => c.id === "synthesizer")!.label).toContain("electronic")
    expect(formInstrumentChoices().find((c) => c.id === "tabla")).toBeTruthy()
  })

  it("the styles on the form are Dada's five", () => {
    expect([...STYLES]).toHaveLength(5)
  })
})

describe("the one line of chips on the rail", () => {
  const chip = (label: string) => ({ label })

  it("shows what fits whole and counts the rest, so no word is cut", () => {
    expect(fitRailChips([chip("Joyful"), chip("Mix")])).toEqual({ shown: [chip("Joyful"), chip("Mix")], more: 0 })
    const two = fitRailChips([chip("Indian style"), chip("Acoustic guitar"), chip("Manipuri")])
    expect(two.shown.map((c) => c.label)).toEqual(["Indian style"])
    expect(two.more).toBe(2)
  })

  it("always shows the first chip, however long, and nothing for an empty field", () => {
    expect(fitRailChips([chip("A very long word of the person's own")]).shown).toHaveLength(1)
    expect(fitRailChips([])).toEqual({ shown: [], more: 0 })
  })
})
