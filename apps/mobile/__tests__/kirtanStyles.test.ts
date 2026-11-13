import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { cleanMoods, isMood, isUploadMood, LEGACY_MOODS, moodChoices, moodLabel, MOODS, UPLOAD_MOODS } from "@/lib/kirtan/moods"
import { cleanStyles, isKnownStyle, isStyle, kindHasStyle, kindRequiresStyle, LEGACY_STYLES, similarStyle, STYLE_OTHER_MAX, styleChoices, styleLabel, STYLES, stylesOfRecord } from "@/lib/kirtan/styles"
import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { ru } from "@/locales/ru"

/** The styles and moods of a recording: a short list the person may choose SEVERAL of, plus their own words (Dada, 9 Nov 2026). */

const API = join(__dirname, "../../api/app")
const idsIn = (source: string, name: string) => {
  const list = new RegExp(`${name}: tuple\\[str, \\.\\.\\.\\] = \\(([^)]*)\\)`).exec(source)?.[1] ?? ""
  return [...list.matchAll(/"([a-z_]+)"/g)].map((m) => m[1])
}

describe("style list", () => {
  it("is Dada's list, in his order; the first list stays readable but is never offered", () => {
    expect([...STYLES]).toEqual(["indian", "electronic", "acoustic_guitar", "african", "western"])
    expect(styleChoices().map((c) => c.id)).toEqual([...STYLES])
    expect([...LEGACY_STYLES]).toEqual(["bengali", "hindi", "brajabuli", "dhrupad", "folk"])
    expect(isStyle("folk")).toBe(false)
    expect(isKnownStyle("folk")).toBe(true)
    expect(styleLabel("folk")).toBe("Folk")
  })

  it("is the same list as the API's, new and old", () => {
    const source = readFileSync(join(API, "services/recording_styles.py"), "utf8")
    expect(idsIn(source, "STYLES")).toEqual([...STYLES])
    expect(idsIn(source, "LEGACY_STYLES")).toEqual([...LEGACY_STYLES])
  })

  it("is asked for every kind but Baba's Audio, and a Kiirtan must name one", () => {
    expect(kindHasStyle("kiirtan")).toBe(true)
    expect(kindHasStyle("bhajan")).toBe(true)
    expect(kindHasStyle("other_mantra")).toBe(true)
    expect(kindHasStyle("baba_audio")).toBe(false)
    expect(kindRequiresStyle("kiirtan")).toBe(true)
    expect(kindRequiresStyle("bhajan")).toBe(false)
  })

  it("sends listed ids once each, own words cleaned, and a word that IS a listed style becomes it", () => {
    expect(cleanStyles("baba_audio", ["indian"], ["Baul"])).toEqual({ styles: [], stylesOther: [], missing: false })
    expect(cleanStyles("bhajan", [], [])).toEqual({ styles: [], stylesOther: [], missing: false })
    expect(cleanStyles("kiirtan", [], [])).toEqual({ styles: [], stylesOther: [], missing: true })
    expect(cleanStyles("kiirtan", ["electronic", "indian", "electronic", "klingon", "folk"], [])).toEqual({ styles: ["electronic", "indian"], stylesOther: [], missing: false })
    expect(cleanStyles("kiirtan", [], ["  acoustic   guitar "])).toEqual({ styles: ["acoustic_guitar"], stylesOther: [], missing: false })
    expect(cleanStyles("kiirtan", [], ["Baul", "baul", "x"])).toEqual({ styles: [], stylesOther: ["Baul"], missing: false })
    const long = cleanStyles("kiirtan", [], [`  Baul   ${"x".repeat(200)}`])
    expect(long.stylesOther[0]?.startsWith("Baul x")).toBe(true)
    expect(long.stylesOther[0]?.length).toBe(STYLE_OTHER_MAX)
  })

  it("reads an old row's one style as a list of one, and offers the listed style for a typo", () => {
    expect(stylesOfRecord({ style: "folk" })).toEqual({ styles: ["folk"], stylesOther: [] })
    expect(stylesOfRecord({ style: "other", styleOther: " Baul " })).toEqual({ styles: [], stylesOther: ["Baul"] })
    expect(stylesOfRecord({ styles: ["indian"], stylesOther: ["Baul"], style: "folk" })).toEqual({ styles: ["indian"], stylesOther: ["Baul"] })
    expect(stylesOfRecord({})).toEqual({ styles: [], stylesOther: [] })
    expect(similarStyle("electonic")).toBe("electronic")
    expect(similarStyle("Electronic")).toBeNull()
  })

  it("has a label in en, ru and es for every style (old ones too) and for the field", () => {
    for (const dict of [en, ru, es]) {
      for (const id of [...STYLES, ...LEGACY_STYLES, "other"]) expect(dict[`style.${id}` as keyof typeof dict], id).toBeTruthy()
      expect(dict["style.field" as keyof typeof dict]).toBeTruthy()
    }
    expect(en["style.indian" as keyof typeof en]).toBe("Indian style")
    expect(en["style.acoustic_guitar" as keyof typeof en]).toBe("Acoustic guitar")
  })
})

describe("mood words", () => {
  it("the form offers Dada's five; the older four stay readable", () => {
    expect([...UPLOAD_MOODS]).toEqual(["joyful", "meditative", "longing", "energetic", "mix"])
    expect([...LEGACY_MOODS]).toEqual(["calm", "ecstatic", "devotion", "sad"])
    expect([...MOODS]).toEqual([...UPLOAD_MOODS, ...LEGACY_MOODS])
    expect(moodChoices().map((c) => c.id)).toEqual([...UPLOAD_MOODS])
    expect(isMood("calm")).toBe(true)
    expect(isUploadMood("calm")).toBe(false)
    expect(isMood("angry")).toBe(false)
  })

  it("are the same lists as the API's", () => {
    const source = readFileSync(join(API, "services/recording_tags.py"), "utf8")
    expect(idsIn(source, "UPLOAD_MOODS")).toEqual([...UPLOAD_MOODS])
    expect(idsIn(source, "LEGACY_MOODS")).toEqual([...LEGACY_MOODS])
  })

  it("read as Dada wrote them", () => {
    expect(UPLOAD_MOODS.map((m) => en[`mood.${m}` as keyof typeof en])).toEqual(["Joyful", "Meditative", "Longing", "Energetic", "Mix"])
    expect(ru["mood.joyful" as keyof typeof ru]).toBe("Радостное")
    for (const m of MOODS) for (const dict of [en, ru, es]) expect(dict[`mood.${m}` as keyof typeof dict], m).toBeTruthy()
    // a mood nobody listed is not dropped: it gets a title made from its own words
    expect(moodLabel("nope")).toBe("Nope")
    expect(moodLabel("deep-peace")).toBe("Deep Peace")
  })

  it("sends the five and own words only; Baba's Audio keeps none", () => {
    expect(cleanMoods("baba_audio", ["joyful"], ["x y"])).toEqual({ moods: [], moodsOther: [] })
    expect(cleanMoods("kiirtan", ["mix", "calm", "joyful", "mix"], [" Deep  peace ", "deep peace", "x", "Energetic"])).toEqual({ moods: ["mix", "joyful", "energetic"], moodsOther: ["Deep peace"] })
  })
})
