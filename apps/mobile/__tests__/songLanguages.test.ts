import { describe, expect, it } from "vitest"

import { groupLanguages, summaryOf, toggleCode } from "@/lib/songPage/languages"

describe("the language menu rules", () => {
  it("toggles in the order chosen", () => {
    expect(toggleCode(["en"], "ru")).toEqual(["en", "ru"])
    expect(toggleCode(["en", "ru"], "en")).toEqual(["ru"])
  })
  it("lists what the song has first (chosen ones on top), then what is not there yet", () => {
    const g = groupLanguages(["en", "ru", "es"], ["ru"], "")
    expect(g.inSong.map((l) => l.code)).toEqual(["ru", "en", "es"])
    expect(g.notYet.map((l) => l.code)).toContain("hi")
    expect(g.notYet.map((l) => l.code)).not.toContain("en")
  })
  it("searches by the English name, the native name and the code, with or without accents", () => {
    expect(groupLanguages(["en", "ru"], [], "рус").inSong.map((l) => l.code)).toEqual(["ru"])
    expect(groupLanguages(["en", "ru"], [], "span").notYet.map((l) => l.code)).toEqual(["es"])
    expect(groupLanguages([], [], "zh").notYet.map((l) => l.code)).toEqual(["zh-CN", "zh-TW"])
  })
  it("summarises a long choice as two names and a count", () => {
    expect(summaryOf(["en", "ru", "es"])).toEqual({ names: "English · Русский", more: 1 })
    expect(summaryOf([])).toEqual({ names: "", more: 0 })
  })
})

describe("a language the app does not list", () => {
  it("is named when it is a known one and kept by its code otherwise", () => {
    const g = groupLanguages(["en", "fr", "xx"], [], "")
    expect(g.inSong.find((l) => l.code === "fr")).toMatchObject({ name: "French", native: "Français" })
    expect(g.inSong.find((l) => l.code === "xx")).toMatchObject({ name: "xx", native: "xx" })
  })
})
