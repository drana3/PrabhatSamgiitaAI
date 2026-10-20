import { describe, expect, it } from "vitest"

import {
  extractTrailingEnglishTheme,
  isEnglishThemeLine,
  stripTrailingThemeFromDevanagari,
} from "./lyricsTheme"

describe("lyricsTheme", () => {
  it("detects Song of … theme lines", () => {
    expect(isEnglishThemeLine("SONG OF FULFILMENT")).toBe(true)
    expect(isEnglishThemeLine("BANDHU HE NIYE CALO")).toBe(false)
  })

  it("peels trailing theme from Roman lyrics", () => {
    const { lyrics, theme } = extractTrailingEnglishTheme(
      "ELO PATHIK\nCETANAR TANE\nSONG OF FULFILLMENT\n",
    )
    expect(theme).toBe("Song of Fulfillment")
    expect(lyrics).not.toMatch(/SONG OF/i)
  })

  it("strips converted theme from Devanagari", () => {
    const cleaned = stripTrailingThemeFromDevanagari(
      "ELO\nCETANAR TANE",
      "एलो\nचेतनार्\nसोन्ग् ओफ़् फ़ुल्फ़िल्ल्मेन्त्",
      "Song of Fulfillment",
    )
    expect(cleaned).toBe("एलो\nचेतनार्")
  })
})
