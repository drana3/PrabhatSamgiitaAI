import { describe, expect, it } from "vitest"

import { languageRows, languageSummary, SCRIPT_ROWS } from "@/lib/languageSheet"
import { REVIEW_STYLE_OPTIONS } from "@/lib/reviewStyleCopy"
import { REVIEW_STYLES } from "@/lib/appearance"

describe("languageRows", () => {
  it("lists the covered languages first, in the prototype's order", () => {
    const codes = languageRows("").map((row) => row.code)
    expect(codes.slice(0, 5)).toEqual(["en", "ru", "fr", "hi", "es"])
    expect(codes.length).toBeGreaterThan(150)
  })
  it("says what each language offers", () => {
    const rows = languageRows("")
    expect(rows[0].native).toBe("English · Lines and word meanings")
    expect(rows[3].native).toContain("Lines only")
    expect(rows[10].native).toContain("Machine translation")
  })
  it("filters by name, native name and code", () => {
    expect(languageRows("russ").map((row) => row.code)).toEqual(["ru"])
    expect(languageRows("Français").map((row) => row.code)[0]).toBe("fr")
    expect(languageRows("zzzz")).toEqual([])
  })
})

describe("languageSummary", () => {
  it("joins script and language codes", () => {
    expect(languageSummary("roman", ["en"])).toBe("Roman + EN")
    expect(languageSummary("devanagari", ["en", "ru"])).toBe("Devanagari + EN + RU")
    expect(languageSummary("roman", [])).toBe("Roman")
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
