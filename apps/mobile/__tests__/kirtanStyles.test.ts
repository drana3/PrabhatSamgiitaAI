import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { cleanStyle, isKiirtanStyle, KIIRTAN_STYLES, OTHER_STYLE, STYLE_OTHER_MAX, styleChoices, styleLabel } from "@/lib/kirtan/styles"
import { isMood, MOODS, moodLabel } from "@/lib/kirtan/moods"
import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { ru } from "@/locales/ru"

/** The style of a Kiirtan (Indian Kiirtan / style) and the six mood words. */

const API = join(__dirname, "../../api/app")

describe("Kiirtan style list", () => {
  it("is Dada's list, in his order, with Other last in the picker", () => {
    expect([...KIIRTAN_STYLES]).toEqual(["bengali", "hindi", "brajabuli", "dhrupad", "folk"])
    expect(styleChoices().map((c) => c.id)).toEqual([...KIIRTAN_STYLES, OTHER_STYLE])
  })

  it("is the same list as the API's", () => {
    const source = readFileSync(join(API, "services/recording_styles.py"), "utf8")
    const list = /STYLES: tuple\[str, \.\.\.\] = \(([^)]*)\)/.exec(source)?.[1] ?? ""
    expect([...list.matchAll(/"([a-z]+)"/g)].map((m) => m[1])).toEqual([...KIIRTAN_STYLES])
  })

  it("only a Kiirtan keeps a style; Other needs a name and a listed style drops it", () => {
    expect(cleanStyle("bhajan", "folk", null)).toEqual({ style: null, styleOther: null, missingName: false })
    expect(cleanStyle("kiirtan", null, "x")).toEqual({ style: null, styleOther: null, missingName: false })
    expect(cleanStyle("kiirtan", "folk", "ignored")).toEqual({ style: "folk", styleOther: null, missingName: false })
    expect(cleanStyle("kiirtan", "other", "   ")).toEqual({ style: "other", styleOther: null, missingName: true })
    const long = cleanStyle("kiirtan", "other", `  Baul   ${"x".repeat(200)}`)
    expect(long.styleOther?.startsWith("Baul x")).toBe(true)
    expect(long.styleOther?.length).toBe(STYLE_OTHER_MAX)
    expect(cleanStyle("kiirtan", "klingon", null).style).toBeNull()
  })

  it("has a label in en, ru and es for every style, Other and the field", () => {
    for (const dict of [en, ru, es]) {
      for (const id of [...KIIRTAN_STYLES, OTHER_STYLE]) expect(dict[`style.${id}` as keyof typeof dict], id).toBeTruthy()
      expect(dict["style.field" as keyof typeof dict]).toBeTruthy()
    }
    expect(en["style.dhrupad" as keyof typeof en]).toBe("Dhrupad-flavoured")
    expect(isKiirtanStyle("folk")).toBe(true)
    expect(isKiirtanStyle("other")).toBe(false)
  })
})

describe("mood words", () => {
  it("are exactly six, Dada's words", () => {
    expect([...MOODS]).toEqual(["joyful", "longing", "calm", "ecstatic", "devotion", "sad"])
    expect(isMood("calm")).toBe(true)
    expect(isMood("angry")).toBe(false)
  })

  it("read as Dada wrote them in Russian", () => {
    expect(MOODS.map((m) => ru[`mood.${m}` as keyof typeof ru])).toEqual(["Радостное", "Тоска", "Спокойное", "Экстатическое", "Преданность", "Грустное"])
    expect(MOODS.map((m) => en[`mood.${m}` as keyof typeof en])).toEqual(["Joyful", "Longing", "Calm", "Ecstatic", "Devotion", "Sad"])
    for (const m of MOODS) expect(es[`mood.${m}` as keyof typeof es], m).toBeTruthy()
    // a mood nobody listed is not dropped: it gets a title made from its own words
    expect(moodLabel("nope")).toBe("Nope")
    expect(moodLabel("deep-peace")).toBe("Deep Peace")
  })
})
