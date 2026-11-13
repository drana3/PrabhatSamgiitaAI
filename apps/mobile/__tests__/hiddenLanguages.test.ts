import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { normalizeLanguagePreference, resolveLanguage, translate } from "@/lib/i18n/core"
import {
  ALL_LANGUAGES,
  LANGUAGE_REGISTRY,
  SHOW_UNFINISHED_LANGUAGES,
  hiddenLanguages,
  offeredLanguages,
  selectableLanguages,
} from "@/lib/i18n/registry"

const read = (file: string) => readFileSync(path.resolve(__dirname, "..", file), "utf8")

describe("languages not yet translated stay out of every list", () => {
  it("offers English, Русский and Español only", () => {
    expect(SHOW_UNFINISHED_LANGUAGES).toBe(false)
    expect([...offeredLanguages()]).toEqual(["en", "ru", "es"])
  })

  it("hides Hindi, Traditional Chinese, Brazilian Portuguese and Korean", () => {
    expect([...hiddenLanguages()]).toEqual(["hi", "zh-TW", "pt-BR", "ko"])
    for (const id of hiddenLanguages()) expect(LANGUAGE_REGISTRY.find((e) => e.id === id)?.complete).toBe(false)
  })

  it("turning one on is the one `complete` flag of its registry entry: the lists are built from it", () => {
    const completeOnes = LANGUAGE_REGISTRY.filter((e) => e.complete).map((e) => e.id)
    expect([...selectableLanguages(false)]).toEqual(completeOnes)
    // the developer switch shows all of them
    expect([...selectableLanguages(true)]).toEqual([...ALL_LANGUAGES])
  })

  it("the Profile language sheet and the onboarding step both read the same list, not a build flag", () => {
    for (const file of ["app/language.tsx", "app/onboarding/language.tsx"]) {
      const source = read(file)
      expect(source, file).toContain("offeredLanguages()")
      expect(source, file).not.toContain("__DEV__")
    }
  })

  it("a person whose stored language is hidden keeps working: the choice is kept and the app speaks English", () => {
    for (const id of ["hi", "zh-TW", "pt-BR", "ko"]) {
      expect(normalizeLanguagePreference(id)).toBe(id)
      expect(resolveLanguage(id as never, [])).toBe(id)
      expect(translate(id as never, "common.done")).toBe(translate("en", "common.done"))
    }
  })

  it("'Automatic' never lands on a hidden language", () => {
    expect(resolveLanguage("auto", ["ko-KR", "hi-IN"])).toBe("en")
    expect(resolveLanguage("auto", ["ko-KR", "ru-RU"])).toBe("ru")
  })
})
