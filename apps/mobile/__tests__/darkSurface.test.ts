import { describe, expect, it } from "vitest"

import { amDark, amDarkSurface } from "@/constants/tokens/amColors"
import { protoDark } from "@/constants/tokens/amToday"
import { spDark } from "@/constants/tokens/amSong"
import { songsTheme } from "@/constants/tokens/amSongs"
import { contrastRatio } from "@/lib/playerV2/coverTint"

describe("dark surfaces: neutral near-black, one source", () => {
  const surfaces = [amDarkSurface.page, amDarkSurface.raised, amDarkSurface.card, amDarkSurface.inner]

  it("every text tone passes WCAG AA on every surface", () => {
    for (const bg of surfaces) {
      expect(contrastRatio(amDarkSurface.heading, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(amDarkSurface.body, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(amDarkSurface.muted, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(amDark.eyebrow, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(amDark.brand, bg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("surfaces carry no green: red and blue are within a few steps of green", () => {
    for (const hex of surfaces) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      expect(g).toBeLessThanOrEqual(r)
      expect(r - b).toBeLessThanOrEqual(12)
    }
  })

  it("the proto, song and songs themes read the same palette", () => {
    expect(protoDark.sand200).toBe(amDark.page)
    expect(spDark.sand200).toBe(amDark.page)
    expect(protoDark.white).toBe(amDark.card)
    expect(spDark.white).toBe(amDark.card)
    expect(songsTheme(amDark, true).page).toBe(amDarkSurface.page)
    expect(songsTheme(amDark, true).ink300).toBe(amDarkSurface.muted)
  })
})
