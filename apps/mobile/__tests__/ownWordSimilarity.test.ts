import { describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { webBaseUrl: "https://example.test" } } } }))

import { similarInstrument, similarWord } from "@/lib/kirtan/instruments"
import { listedLanguageFor, similarLanguage } from "@/lib/kirtan/languages"
import { similarStyle } from "@/lib/kirtan/styles"

describe("one similarity rule for every own-word field", () => {
  it("style: a near spelling of a listed style is offered, a listed one is not", () => {
    expect(similarStyle("Electonic")).toBe("electronic")
    expect(similarStyle("acoustic guitr")).toBe("acoustic_guitar")
    expect(similarStyle("electronic")).toBeNull()
    expect(similarStyle("Jazz")).toBeNull()
    expect(similarStyle("")).toBeNull()
  })

  it("language: 'Bengalli' means Bengali; a listed name is the language itself, not a suggestion", () => {
    expect(similarLanguage("Bengalli")).toBe("bn")
    expect(listedLanguageFor(" russian ")).toBe("ru")
    expect(similarLanguage("Russian")).toBeNull()
    expect(similarLanguage("Quenya")).toBeNull()
    expect(similarLanguage(null)).toBeNull()
  })

  it("instrument keeps working through the shared rule", () => {
    expect(similarInstrument("harmonyum")).toBeTruthy()
  })

  it("similarWord ignores case, spaces and a missing text", () => {
    expect(similarWord("  ", { a: ["alpha"] })).toBeNull()
    expect(similarWord("ALPHAA", { a: ["alpha"] })).toBe("a")
  })
})
