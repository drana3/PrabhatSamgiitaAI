import { describe, expect, it } from "vitest"

import { sampleLanguageRows } from "@/lib/languageSheet"
import { SAMPLE_LANGUAGES } from "@/lib/fixtures/translations"

describe("sampleLanguageRows (prototype language sheet)", () => {
  it("lists every sample language with no query", () => {
    expect(sampleLanguageRows("")).toHaveLength(SAMPLE_LANGUAGES.length)
  })

  it("offers Request only for languages that are not added yet", () => {
    const rows = sampleLanguageRows("")
    for (const row of rows) expect(row.action).toBe(row.pending ? "Request" : "")
  })

  it("turns a requested language into Requested with no button", () => {
    const pending = sampleLanguageRows("").find((r) => r.pending)!
    const after = sampleLanguageRows("", new Set([pending.code])).find((r) => r.code === pending.code)!
    expect(after.action).toBe("")
    expect(after.native).toContain("Requested")
  })

  it("filters by name or native name, ignoring case", () => {
    const first = SAMPLE_LANGUAGES[0]
    const rows = sampleLanguageRows(first.name.toUpperCase())
    expect(rows.some((r) => r.code === first.code)).toBe(true)
    expect(sampleLanguageRows("zzzzqq")).toHaveLength(0)
  })
})
