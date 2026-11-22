import { describe, expect, it } from "vitest"

import {
  inferStanzaBlankLines,
  isCorruptLyricPaddingLine,
  isCatalogLanguageLabelLine,
  prepareCatalogLyricsFields,
  sanitizeCatalogLyricsText,
} from "./catalogLyrics"

describe("catalogLyrics", () => {
  it("detects Á-only padding lines", () => {
    expect(isCorruptLyricPaddingLine("ÁÁÁÁÁÁÁÁÁÁ")).toBe(true)
    expect(isCorruptLyricPaddingLine("BANDHU HE NIYE CALO")).toBe(false)
  })

  it("strips SAMSKRTA language label from PS 1565 lyrics", () => {
    const raw = "SAḾSKRTA\nVAJRA KAT́HORA KUSUMA KORAKA"
    const cleaned = sanitizeCatalogLyricsText(raw, {
      language: "Roman",
      languageLabels: ["Sanskrit"],
    })
    expect(cleaned).toMatch(/^VAJRA/)
    expect(cleaned).not.toMatch(/SAM/i)
  })

  it("fixes PS 4404 title from first real lyric line", () => {
    const row = prepareCatalogLyricsFields({
      title: "ÁÁÁÁÁÁÁÁÁÁ",
      first_line: "ÁÁÁÁÁÁÁÁÁÁ",
      language: "Roman",
      lyrics_original:
        "ÁÁÁÁÁÁÁÁÁÁ\nESE CHILE TUMI ÁMÁR JIIVANE\nKATA JANAMER PUŃYA PHALE",
    } as never)
    expect(row.title).toBe("ESE CHILE TUMI ÁMÁR JIIVANE")
    expect(row.lyrics_original).toMatch(/^ESE CHILE/)
    expect(row.lyrics_original).not.toMatch(/ÁÁÁ/)
  })

  it("inserts stanza gaps before refrain returns", () => {
    const lines = [
      "BANDHU HE NIYE CALO",
      "ÁLOR OI JHARAŃÁ",
      "BANDHU HE NIYE CALO",
      "GHUMER GHOR",
    ]
    expect(inferStanzaBlankLines(lines)).toEqual([
      "BANDHU HE NIYE CALO",
      "ÁLOR OI JHARAŃÁ",
      "",
      "BANDHU HE NIYE CALO",
      "GHUMER GHOR",
    ])
  })

  it("inserts stanza gaps before a repeating refrain couplet (PS 100 style)", () => {
    const lines = [
      "KAMALA NEBUR",
      "NUTAN CHANDE ESECHO",
      "AJ NUTAN CHANDE ESECHO",
      "HIMANIR MAJHE",
      "NUTAN CHANDE ESECHO",
      "AJ NUTAN CHANDE ESECHO",
    ]
    const withGaps = inferStanzaBlankLines(lines)
    expect(withGaps.filter((line) => !line.trim()).length).toBeGreaterThan(0)
    expect(withGaps[withGaps.indexOf("NUTAN CHANDE ESECHO", 3)]).toBe("NUTAN CHANDE ESECHO")
  })

  it("preserves stanza gaps already present from the official page", () => {
    const lines = ["REFRAIN", "STANZA A", "", "REFRAIN", "STANZA B"]
    expect(inferStanzaBlankLines(lines)).toEqual(lines)
  })

  it("treats samskrta as sanskrit label", () => {
    expect(isCatalogLanguageLabelLine("SAḾSKRTA", "Roman", ["Sanskrit"])).toBe(true)
  })
})