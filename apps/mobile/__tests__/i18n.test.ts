import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: async (key: string) => {
        memory.delete(key)
      },
    },
  }
})

import AsyncStorage from "@react-native-async-storage/async-storage"

import {
  getActiveLanguage,
  normalizeLanguagePreference,
  pluralForm,
  resolveLanguage,
  setActiveLanguage,
  subscribeLanguage,
  t,
  translate,
  translatorFor,
} from "@/lib/i18n/core"
import { formatBytes, formatDate, formatNumber, formatTime } from "@/lib/i18n/format"
import { dictionaries } from "@/locales"
import { useLanguageStore } from "@/stores/languageStore"

afterEach(() => setActiveLanguage("en"))

describe("plural rules", () => {
  it("Russian: one / few / many / other", () => {
    const form = (n: number) => pluralForm("ru", n)
    expect([1, 21, 101, 1001].map(form)).toEqual(["one", "one", "one", "one"])
    expect([2, 3, 4, 22, 23, 24, 102].map(form)).toEqual(Array(7).fill("few"))
    expect([0, 5, 9, 11, 12, 13, 14, 15, 19, 20, 25, 100, 111, 112, 114].map(form)).toEqual(Array(15).fill("many"))
    expect(form(1.5)).toBe("other")
  })
  it("English and Spanish: one / other", () => {
    for (const lang of ["en", "es"] as const) {
      expect(pluralForm(lang, 1)).toBe("one")
      expect([0, 2, 5, 21, 1.5].map((n) => pluralForm(lang, n))).toEqual(Array(5).fill("other"))
    }
  })
})

describe("translate", () => {
  const original = { ...dictionaries.en } as Record<string, string>
  const patched = dictionaries as unknown as Record<string, Record<string, string>>

  function withKeys(entries: { en?: Record<string, string>; ru?: Record<string, string> }, run: () => void) {
    const savedEn = patched.en
    const savedRu = patched.ru
    patched.en = { ...original, ...entries.en }
    patched.ru = { ...savedRu, ...entries.ru }
    try {
      run()
    } finally {
      patched.en = savedEn as Record<string, string>
      patched.ru = savedRu as Record<string, string>
    }
  }

  it("interpolates variables and formats numbers by language", () => {
    withKeys({ en: { "test.hello": "Hello, {name}" } }, () => {
      expect(translate("en", "test.hello", { name: "Dada" })).toBe("Hello, Dada")
    })
    withKeys({ en: { "test.n": "{count} items", "test.y": "in {year}" }, ru: { "test.n": "{count} штук" } }, () => {
      expect(translate("en", "test.n", { count: 12345 })).toBe("12,345 items")
      expect(translate("ru", "test.n", { count: 12345 })).toBe("12\u00a0345 штук")
      expect(translate("en", "test.y", { year: 1983 })).toBe("in 1983")
    })
  })

  it("picks the Russian plural form, and the English one when falling back", () => {
    withKeys(
      {
        en: { "test.songs_one": "{count} song", "test.songs_other": "{count} songs" },
        ru: {
          "test.songs_one": "{count} песня",
          "test.songs_few": "{count} песни",
          "test.songs_many": "{count} песен",
          "test.songs_other": "{count} песни",
        },
      },
      () => {
        expect(translate("ru", "test.songs", { count: 1 })).toBe("1 песня")
        expect(translate("ru", "test.songs", { count: 3 })).toBe("3 песни")
        expect(translate("ru", "test.songs", { count: 11 })).toBe("11 песен")
        expect(translate("ru", "test.songs", { count: 21 })).toBe("21 песня")
        expect(translate("en", "test.songs", { count: 1 })).toBe("1 song")
        expect(translate("en", "test.songs", { count: 2 })).toBe("2 songs")
      },
    )
  })

  it("falls back to English for a key the language lacks, and to the key itself for an unknown one", () => {
    withKeys({ en: { "test.onlyEn": "Only English" } }, () => {
      expect(translate("ru", "test.onlyEn")).toBe("Only English")
      expect(translate("es", "test.onlyEn")).toBe("Only English")
    })
    expect(translate("ru", "test.nope.nothing")).toBe("test.nope.nothing")
  })

  it("leaves {unknown} placeholders visible instead of printing undefined", () => {
    withKeys({ en: { "test.p": "A {x} B" } }, () => {
      expect(translate("en", "test.p", {})).toBe("A {x} B")
    })
  })

  it("plain t() follows the active language; translatorFor is stable", () => {
    expect(t("common.done")).toBe("Done")
    setActiveLanguage("ru")
    expect(t("common.done")).toBe("Готово")
    setActiveLanguage("es")
    expect(t("common.done")).toBe("Listo")
    expect(translatorFor("ru")).toBe(translatorFor("ru"))
  })

  it("notifies subscribers once per real change", () => {
    const listener = vi.fn()
    const off = subscribeLanguage(listener)
    setActiveLanguage("ru")
    setActiveLanguage("ru")
    setActiveLanguage("es")
    off()
    setActiveLanguage("en")
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe("language resolution", () => {
  it("auto picks the first supported device language, else English", () => {
    expect(resolveLanguage("auto", ["ru-RU"])).toBe("ru")
    expect(resolveLanguage("auto", ["pt", "es"])).toBe("es")
    expect(resolveLanguage("auto", ["ja", "zh"])).toBe("en")
    expect(resolveLanguage("auto", [])).toBe("en")
    expect(resolveLanguage("es", ["ru"])).toBe("es")
  })
  it("normalizes stored garbage to English, the default, and keeps a real choice", () => {
    expect(normalizeLanguagePreference("fr")).toBe("en")
    expect(normalizeLanguagePreference(undefined)).toBe("en")
    expect(normalizeLanguagePreference("auto")).toBe("auto")
    expect(normalizeLanguagePreference("ru")).toBe("ru")
  })
})

describe("language store", () => {
  it("setLanguage applies at once and is persisted under prabhat-language", async () => {
    useLanguageStore.getState().setLanguage("ru")
    expect(getActiveLanguage()).toBe("ru")
    await new Promise((resolve) => setTimeout(resolve, 0))
    const stored = JSON.parse((await AsyncStorage.getItem("prabhat-language")) as string)
    expect(stored.state.language).toBe("ru")
    useLanguageStore.getState().setLanguage("auto")
    expect(getActiveLanguage()).toBe("en") // no device module in tests: English
  })
})

describe("formatting", () => {
  it("numbers follow the language", () => {
    expect(formatNumber(1234.5, { maximumFractionDigits: 1 }, "en")).toBe("1,234.5")
    expect(formatNumber(1234.5, { maximumFractionDigits: 1 }, "ru")).toBe("1 234,5")
    expect(formatNumber(12345, undefined, "es")).toBe("12.345")
  })
  it("sizes use the translated unit", () => {
    expect(formatBytes(0, "en")).toBe("0 MB")
    expect(formatBytes(16_900_000, "en")).toBe("17 MB")
    expect(formatBytes(4_400_000, "ru")).toBe("4,4 МБ")
    expect(formatBytes(1_500_000_000, "ru")).toBe("1,5 ГБ")
    expect(formatBytes(20_000, "es")).toBe("<0,1 MB")
  })
  it("dates and times do not throw and differ by language", () => {
    const d = new Date(2026, 10, 5, 18, 30)
    expect(formatDate(d, "short", "en")).toBe("Nov 5")
    expect(formatDate(d, "short", "ru")).toContain("нояб")
    expect(formatDate(d, "short", "es")).toContain("nov")
    expect(formatTime(d, "ru")).toBe("18:30")
    expect(formatDate("not a date")).toBe("")
  })
})
