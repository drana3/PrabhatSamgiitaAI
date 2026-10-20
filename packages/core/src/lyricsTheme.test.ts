import { describe, expect, it } from "vitest"

import { extractTrailingEnglishTheme, isEnglishThemeLine } from "./lyricsTheme"

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
})
