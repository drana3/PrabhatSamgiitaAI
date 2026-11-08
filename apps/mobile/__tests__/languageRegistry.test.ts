import { describe, expect, it } from "vitest"

import {
  DEFAULT_LANGUAGE_PREFERENCE,
  LANGUAGES,
  LANGUAGE_NATIVE_NAMES,
  LOCALE_TAGS,
  REQUIRED_PLURAL_FORMS,
  formatNumberFor,
  normalizeLanguagePreference,
  pluralForm,
  resolveLanguage,
  translate,
} from "@/lib/i18n/core"
import {
  ALL_LANGUAGES,
  COMPLETE_LANGUAGES,
  LANGUAGE_REGISTRY,
  STUB_LANGUAGES,
  entryFor,
  matchDeviceLanguage,
  selectableLanguages,
} from "@/lib/i18n/registry"
import { dictionaries } from "@/locales"

describe("language registry", () => {
  it("lists the seven languages, English first", () => {
    expect(ALL_LANGUAGES).toEqual(["en", "ru", "es", "hi", "zh-TW", "pt-BR", "ko"])
    expect(LANGUAGE_NATIVE_NAMES["zh-TW"]).toBe("繁體中文")
    expect(LANGUAGE_NATIVE_NAMES["pt-BR"]).toBe("Português (Brasil)")
    expect(LOCALE_TAGS["zh-TW"]).toBe("zh-TW")
  })

  it("has a dictionary for every registered language and no other", () => {
    expect(Object.keys(dictionaries).sort()).toEqual([...ALL_LANGUAGES].sort())
  })

  it("English is the default and is complete; new installs start in English", () => {
    expect(DEFAULT_LANGUAGE_PREFERENCE).toBe("en")
    expect(normalizeLanguagePreference(undefined)).toBe("en")
    expect(entryFor("en").complete).toBe(true)
  })

  it("stubs are empty dictionaries and speak English", () => {
    expect(STUB_LANGUAGES).toEqual(["hi", "zh-TW", "pt-BR", "ko"])
    for (const language of STUB_LANGUAGES) {
      expect(Object.keys(dictionaries[language]).length, language).toBe(0)
      expect(translate(language, "common.done"), language).toBe(translate("en", "common.done"))
    }
  })

  it("LANGUAGES holds only the finished ones", () => {
    expect([...LANGUAGES]).toEqual([...COMPLETE_LANGUAGES])
    expect([...LANGUAGES]).toEqual(["en", "ru", "es"])
  })

  it("every language declares the plural forms its rule needs", () => {
    expect(REQUIRED_PLURAL_FORMS.ru).toEqual(["one", "few", "many", "other"])
    expect(REQUIRED_PLURAL_FORMS.ko).toEqual(["other"])
    expect(REQUIRED_PLURAL_FORMS["zh-TW"]).toEqual(["other"])
    expect(REQUIRED_PLURAL_FORMS.hi).toEqual(["one", "other"])
  })

  it("plural rules: Chinese and Korean never say one, Hindi and Portuguese call 0 and 1 one", () => {
    expect(pluralForm("ko", 1)).toBe("other")
    expect(pluralForm("zh-TW", 1)).toBe("other")
    expect(pluralForm("hi", 0)).toBe("one")
    expect(pluralForm("hi", 1)).toBe("one")
    expect(pluralForm("hi", 2)).toBe("other")
    expect(pluralForm("pt-BR", 0)).toBe("one")
    expect(pluralForm("pt-BR", 2)).toBe("other")
    expect(pluralForm("ru", 3)).toBe("few")
    expect(pluralForm("es", 1)).toBe("one")
  })

  it("number fallback follows each language's separators", () => {
    expect(formatNumberFor("pt-BR", 1234.5)).toMatch(/1\.234,5|1234,5/)
    expect(formatNumberFor("en", 1234)).toMatch(/1,234/)
  })
})

describe("device language matching", () => {
  it("Portuguese of any region is pt-BR, Traditional Chinese is zh-TW, Simplified is nothing", () => {
    expect(matchDeviceLanguage("pt-PT", { includeStubs: true })).toBe("pt-BR")
    expect(matchDeviceLanguage("pt_BR", { includeStubs: true })).toBe("pt-BR")
    expect(matchDeviceLanguage("zh-Hant-TW", { includeStubs: true })).toBe("zh-TW")
    expect(matchDeviceLanguage("zh-HK", { includeStubs: true })).toBe("zh-TW")
    expect(matchDeviceLanguage("zh-Hans-CN", { includeStubs: true })).toBeNull()
    expect(matchDeviceLanguage("zh", { includeStubs: true })).toBeNull()
    expect(matchDeviceLanguage("ko-KR", { includeStubs: true })).toBe("ko")
    expect(matchDeviceLanguage("hi-IN", { includeStubs: true })).toBe("hi")
  })

  it("Automatic skips a stub and takes the next finished device language", () => {
    expect(matchDeviceLanguage("ko-KR")).toBeNull()
    expect(resolveLanguage("auto", ["ko-KR", "es-MX"])).toBe("es")
    expect(resolveLanguage("auto", ["ko-KR"])).toBe("en")
    expect(resolveLanguage("auto", ["ru-RU", "en-US"])).toBe("ru")
  })

  it("a language that is not on the list is English, whatever the phone says", () => {
    expect(resolveLanguage("en", ["ru-RU", "es"])).toBe("en")
    expect(resolveLanguage("auto", ["fr-FR", "de"])).toBe("en")
  })
})

describe("selectable languages", () => {
  it("a release build offers only finished languages; a development build offers all", () => {
    expect([...selectableLanguages(false)]).toEqual(["en", "ru", "es"])
    expect([...selectableLanguages(true)]).toEqual([...ALL_LANGUAGES])
  })

  it("adding a language needs only an entry: every entry carries all the fields", () => {
    for (const entry of LANGUAGE_REGISTRY) {
      expect(entry.native.length, entry.id).toBeGreaterThan(0)
      expect(entry.deviceTags.length, entry.id).toBeGreaterThan(0)
      expect(entry.group).not.toBe(entry.decimal)
    }
  })
})
