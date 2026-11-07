import { describe, expect, it } from "vitest"

import { languageSummary, lyricLanguageRows, SCRIPT_ROWS } from "@/lib/languageSheet"
import { REVIEW_STYLE_OPTIONS } from "@/lib/reviewStyleCopy"
import { REVIEW_STYLES } from "@/lib/appearance"

describe("lyricLanguageRows", () => {
  it("lists exactly the offered languages, each in its own script with the English name under it", () => {
    const rows = lyricLanguageRows()
    expect(rows.map((row) => row.code)).toEqual(["en", "ru", "es", "zh-CN", "zh-TW", "hi"])
    expect(rows.map((row) => row.name)).toEqual(["English", "Русский", "Español", "简体中文", "繁體中文 (台灣)", "हिन्दी"])
    expect(rows[1].sub).toBe("Russian")
    expect(rows[4].sub).toBe("Chinese (Traditional, Taiwan)")
  })
  it("claims nothing about coverage without the preview's sample coverage", () => {
    for (const row of lyricLanguageRows()) expect(row.pending).toBe(false)
  })
  it("adds the preview's sample coverage and marks what is not added yet", () => {
    const rows = lyricLanguageRows({ en: "full", ru: "full", es: "lines", hi: "lines" })
    expect(rows[0].sub).toBe("Lines and word meanings")
    expect(rows[2].sub).toBe("Spanish · Lines only")
    expect(rows[3].sub).toBe("Chinese (Simplified) · Not added yet")
    expect(rows[3].pending).toBe(true)
  })
})

describe("languageSummary", () => {
  it("joins script and language codes", () => {
    expect(languageSummary("roman", ["en"])).toBe("Roman + EN")
    expect(languageSummary("devanagari", ["en", "ru"])).toBe("Devanagari + EN + RU")
    expect(languageSummary("roman", [])).toBe("Roman")
    expect(languageSummary("roman", ["zh-CN", "zh-TW"])).toBe("Roman + ZH-CN + ZH-TW")
  })
  it("offers the three prototype scripts and Both", () => {
    expect(SCRIPT_ROWS.map((row) => row.id)).toEqual(["roman", "devanagari", "bengali", "both"])
  })
})

describe("review style copy", () => {
  it("covers every review style once", () => {
    expect(REVIEW_STYLE_OPTIONS.map((option) => option.id)).toEqual([...REVIEW_STYLES])
  })
})
