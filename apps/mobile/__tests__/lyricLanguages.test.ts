import { describe, expect, it } from "vitest"

import {
  FOLLOW_APP,
  LYRIC_LANGUAGES,
  LYRIC_LANGUAGE_CODES,
  defaultLyricLanguage,
  gapNotice,
  lyricGaps,
  languageChoiceRows,
  lyricLanguageTitle,
  migratePlayerLanguages,
  migrateSongPageLanguages,
  effectiveTranslations,
  normalizeStoredTranslations,
  normalizeLyricChoice,
  pickShown,
  resolveLyricChoice,
  resolveLyricLanguage,
} from "@/lib/songPage/lyricLanguages"
import { localeOptions } from "@/constants/languages"
import { glossaryGloss } from "@/lib/fixtures/songPage"

describe("lyric languages: one list", () => {
  it("offers exactly English, Russian, Spanish, Chinese (Simplified), Chinese (Traditional, Taiwan), then Hindi", () => {
    expect(LYRIC_LANGUAGES.map((l) => l.name)).toEqual([
      "English",
      "Russian",
      "Spanish",
      "Chinese (Simplified)",
      "Chinese (Traditional, Taiwan)",
      "Hindi",
    ])
  })

  it("shows each language in its own script plus the English name", () => {
    expect(lyricLanguageTitle("ru")).toBe("Русский · Russian")
    expect(lyricLanguageTitle("es")).toBe("Español · Spanish")
    expect(lyricLanguageTitle("zh-CN")).toBe("简体中文 · Chinese (Simplified)")
    expect(lyricLanguageTitle("zh-TW")).toBe("繁體中文 (台灣) · Chinese (Traditional, Taiwan)")
    expect(lyricLanguageTitle("en")).toBe("English")
  })

  it("uses codes the translation API knows", () => {
    const known = new Set(localeOptions.map((o) => o.code))
    for (const code of LYRIC_LANGUAGE_CODES) expect(known.has(code)).toBe(true)
  })
})

describe("lyric languages: the default is the language of the app", () => {
  it("follows the app language when it is offered, else English", () => {
    expect(defaultLyricLanguage("en")).toBe("en")
    expect(defaultLyricLanguage("ru")).toBe("ru")
    expect(defaultLyricLanguage("es")).toBe("es")
    expect(defaultLyricLanguage("fr")).toBe("en")
    expect(defaultLyricLanguage(undefined)).toBe("en")
  })

  it("resolves a saved choice, and a choice that is not offered any more (French) falls back to the app language", () => {
    expect(resolveLyricLanguage(FOLLOW_APP, "ru")).toBe("ru")
    expect(resolveLyricLanguage(null, "es")).toBe("es")
    expect(resolveLyricLanguage("zh-TW", "ru")).toBe("zh-TW")
    expect(resolveLyricLanguage("fr", "ru")).toBe("ru")
    expect(resolveLyricChoice("off", "ru")).toBe("off")
    expect(resolveLyricChoice(FOLLOW_APP, "ru")).toBe("ru")
  })

  it("normalises stored values", () => {
    expect(normalizeLyricChoice("off")).toBe("off")
    expect(normalizeLyricChoice("ru")).toBe("ru")
    expect(normalizeLyricChoice("fr")).toBe(FOLLOW_APP)
    expect(normalizeLyricChoice(3)).toBe(FOLLOW_APP)
    expect(normalizeLyricChoice(undefined)).toBe(FOLLOW_APP)
  })
})

describe("lyric languages: an honest gap, never a silent swap", () => {
  const has = (set: string[]) => (code: string) => set.includes(code)

  it("shows the language when the song has it", () => {
    expect(pickShown("ru", has(["en", "ru"]))).toEqual({ wanted: "ru", shown: "ru", gap: false })
  })

  it("falls back to English and says so", () => {
    const pick = pickShown("ru", has(["en"]))
    expect(pick).toEqual({ wanted: "ru", shown: "en", gap: true })
    expect(gapNotice(pick)).toBe("Not available in Russian yet. Showing English.")
  })

  it("shows nothing, and says so, when the song has no English either", () => {
    const pick = pickShown("zh-CN", has([]))
    expect(pick.shown).toBeNull()
    expect(gapNotice(pick)).toBe("Not available in Chinese (Simplified) yet.")
  })

  it("English itself is never a gap when present", () => {
    expect(pickShown("en", has(["en"])).gap).toBe(false)
    expect(pickShown("en", has([])).shown).toBeNull()
  })

  it("rows say which languages the song lacks", () => {
    const rows = languageChoiceRows(has(["en", "hi"]))
    expect(rows.map((r) => [r.code, r.state])).toEqual([
      ["en", "available"],
      ["ru", "missing"],
      ["es", "missing"],
      ["zh-CN", "missing"],
      ["zh-TW", "missing"],
      ["hi", "available"],
    ])
  })
})

describe("lyric languages: gaps of the two player settings", () => {
  const input = (translation: string, wordLanguage: string, tr: string[], words: string[]) => ({
    translation,
    wordLanguage,
    hasTranslationIn: (c: string) => tr.includes(c),
    hasWordMeaningsIn: (c: string) => words.includes(c),
  })

  it("has no gap when the song has what was asked for", () => {
    expect(lyricGaps(input("ru", "en", ["en", "ru"], ["en"]))).toEqual([])
  })

  it("names each setting separately, so Words and Meaning can differ", () => {
    const gaps = lyricGaps(input("ru", "es", ["en", "ru"], ["en"]))
    expect(gaps.map((g) => [g.kind, g.wanted, g.shown])).toEqual([["words", "es", "en"]])
    expect(gaps[0].text).toBe("Not available in Spanish yet. Showing English.")
  })

  it("Off is never a gap", () => {
    expect(lyricGaps(input("off", "off", [], []))).toEqual([])
  })
})

describe("sample word meanings are only claimed for the languages they have", () => {
  it("English, Russian and French are real; Spanish and the rest are null, not English under another name", () => {
    expect(glossaryGloss("Bandhu", "en")).toBe("friend")
    expect(glossaryGloss("Bandhu", "ru")).not.toBeNull()
    expect(glossaryGloss("Bandhu", "es")).toBeNull()
    expect(glossaryGloss("Bandhu", "zh-CN")).toBeNull()
    expect(glossaryGloss("Bandhu", "hi")).toBeNull()
  })
})

describe("player store v1 to v2", () => {
  it("old defaults follow the app; explicit Russian and Off stay; wordMeanings goes away", () => {
    expect(migratePlayerLanguages({ translation: "en", wordMeanings: true, script: "roman" })).toEqual({ script: "roman", translation: "auto", wordLanguage: "auto" })
    expect(migratePlayerLanguages({ translation: "ru", wordMeanings: false })).toEqual({ translation: "ru", wordLanguage: "off" })
    expect(migratePlayerLanguages({ translation: "off" })).toEqual({ translation: "off", wordLanguage: "auto" })
    expect(migratePlayerLanguages(undefined)).toEqual({ translation: "auto", wordLanguage: "auto" })
  })
})

describe("song page store: translations follow the app until chosen", () => {
  it("empty means the app language; a saved list is kept, minus languages that are no longer offered", () => {
    expect(effectiveTranslations([], "ru")).toEqual(["ru"])
    expect(effectiveTranslations(undefined, "en")).toEqual(["en"])
    expect(effectiveTranslations(["es", "fr"], "ru")).toEqual(["es"])
    expect(effectiveTranslations(["fr"], "ru")).toEqual(["ru"])
  })

  it("normalises a stored list to at most two offered languages", () => {
    expect(normalizeStoredTranslations(["en", "ru", "es"], 2)).toEqual(["ru", "es"])
    expect(normalizeStoredTranslations(["fr"], 2)).toEqual([])
    expect(normalizeStoredTranslations("x", 2)).toEqual([])
  })

  it("v1 default [en] becomes follow-the-app; an explicit choice stays", () => {
    expect(migrateSongPageLanguages({ translations: ["en"], script: "roman" })).toEqual({ translations: [], script: "roman" })
    expect(migrateSongPageLanguages({ translations: ["ru"] })).toEqual({ translations: ["ru"] })
    expect(migrateSongPageLanguages({ translations: ["en", "ru"] })).toEqual({ translations: ["en", "ru"] })
  })
})
