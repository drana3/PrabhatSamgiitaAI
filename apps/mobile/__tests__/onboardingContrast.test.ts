import { describe, expect, it } from "vitest"

import { amColors, amDark, amDarkSurface, amLight } from "@/constants/tokens/amColors"

/**
 * Every text/background and control/background pair that the onboarding board lists in its section
 * "Токены приложения / Тёмная тема" (Carousel/Для-Дады/онбординг-v2), computed from the real tokens, in
 * both themes. Text needs 4.5:1 (WCAG AA); large text and parts of controls (outlines, tracks, filled
 * radios, rings) need 3:1.
 */

type Rgb = [number, number, number]

function parse(color: string): { rgb: Rgb; a: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 }
  }
  const m = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/.exec(color)
  if (!m) throw new Error(`unsupported colour ${color}`)
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) }
}

/** A possibly translucent colour laid over an opaque base. */
function over(color: string, base: Rgb): Rgb {
  const { rgb, a } = parse(color)
  return [0, 1, 2].map((i) => Math.round(rgb[i]! * a + base[i]! * (1 - a))) as Rgb
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** `bg` may be translucent: it is laid over `ground` (default: the theme page). */
function ratio(fg: string, bg: string, ground: string): number {
  const base = parse(ground).rgb
  const bgRgb = over(bg, base)
  const fgRgb = over(fg, bgRgb)
  const [hi, lo] = [luminance(fgRgb), luminance(bgRgb)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

type Pair = { what: string; fg: string; bg: string; ground: string; min: number }
const TEXT = 4.5
const PART = 3

const D = amDarkSurface
/** the warm wash at the top of an onboarding page, and the selected-row fill (board CSS: --wash, --selbg) */
const darkWash = "rgba(58, 36, 24, 0.5)"
const lightWash = "rgba(255, 220, 197, 0.75)"
const lightSel = "rgba(255, 220, 197, 0.5)"

const dark: Pair[] = [
  { what: "muted on card", fg: amDark.textMuted, bg: amDark.card, ground: D.page, min: TEXT },
  { what: "muted on inner", fg: amDark.textMuted, bg: amDark.inner, ground: D.page, min: TEXT },
  { what: "muted on tile", fg: amDark.textMuted, bg: D.tile, ground: D.page, min: TEXT },
  { what: "muted on selected row", fg: amDark.textMuted, bg: D.peach, ground: D.page, min: TEXT },
  { what: "body on selected row", fg: amDark.textBody, bg: D.peach, ground: D.page, min: TEXT },
  { what: "heading on selected row", fg: amDark.textHeading, bg: D.peach, ground: D.page, min: TEXT },
  { what: "heading on page", fg: amDark.textHeading, bg: amDark.page, ground: D.page, min: TEXT },
  { what: "body on card", fg: amDark.textBody, bg: amDark.card, ground: D.page, min: TEXT },
  { what: "accent text on page", fg: amDark.accentText, bg: amDark.page, ground: D.page, min: TEXT },
  { what: "accent text on the warm wash (step label)", fg: amDark.accentText, bg: darkWash, ground: D.page, min: TEXT },
  { what: "accent text on card", fg: amDark.accentText, bg: amDark.card, ground: D.page, min: TEXT },
  { what: "white on action button", fg: amDark.onBrand, bg: amDark.brand, ground: D.page, min: TEXT },
  { what: "white on pressed action button", fg: amDark.onBrand, bg: amDark.brandPress, ground: D.page, min: TEXT },
  { what: "error text on card", fg: amDark.dangerText, bg: amDark.card, ground: D.page, min: TEXT },
  { what: "second heading line on page (large)", fg: amDark.headingSecond, bg: amDark.page, ground: D.page, min: PART },
  // parts of controls
  { what: "progress track on page", fg: amDark.trackOff, bg: amDark.page, ground: D.page, min: PART },
  { what: "button outline (lineStrong) on page", fg: amDark.lineStrong, bg: amDark.page, ground: D.page, min: PART },
  { what: "field outline (lineStrong) on card", fg: amDark.lineStrong, bg: amDark.card, ground: D.page, min: PART },
  { what: "empty radio ring on card", fg: amDark.textMuted, bg: amDark.card, ground: D.page, min: PART },
  { what: "filled radio (controlOn) on selected row", fg: amDark.controlOn, bg: D.peach, ground: D.page, min: PART },
  { what: "filled radio (controlOn) on card", fg: amDark.controlOn, bg: amDark.card, ground: D.page, min: PART },
  { what: "dot on the filled radio", fg: amDark.controlOnDot, bg: amDark.controlOn, ground: D.page, min: PART },
  { what: "focus ring on page", fg: amDark.accentBright, bg: amDark.page, ground: D.page, min: PART },
  { what: "focus ring on card", fg: amDark.accentBright, bg: amDark.card, ground: D.page, min: PART },
  { what: "action button against the page", fg: amDark.brand, bg: amDark.page, ground: D.page, min: PART },
]

const light: Pair[] = [
  { what: "muted on card", fg: amLight.textMuted, bg: amLight.card, ground: amLight.page, min: TEXT },
  { what: "muted on page", fg: amLight.textMuted, bg: amLight.page, ground: amLight.page, min: TEXT },
  { what: "muted on inner", fg: amLight.textMuted, bg: amLight.inner, ground: amLight.page, min: TEXT },
  { what: "muted on selected row", fg: amLight.textMuted, bg: lightSel, ground: amLight.card, min: TEXT },
  { what: "body on selected row", fg: amLight.textBody, bg: lightSel, ground: amLight.card, min: TEXT },
  { what: "heading on page", fg: amLight.textHeading, bg: amLight.page, ground: amLight.page, min: TEXT },
  { what: "body on card", fg: amLight.textBody, bg: amLight.card, ground: amLight.page, min: TEXT },
  { what: "accent text on page", fg: amLight.accentText, bg: amLight.page, ground: amLight.page, min: TEXT },
  { what: "accent text on the warm wash (step label)", fg: amLight.accentText, bg: lightWash, ground: amLight.page, min: TEXT },
  { what: "accent text on card", fg: amLight.accentText, bg: amLight.card, ground: amLight.page, min: TEXT },
  { what: "white on action button", fg: amLight.onBrand, bg: amLight.brand, ground: amLight.page, min: TEXT },
  { what: "white on pressed action button", fg: amLight.onBrand, bg: amLight.brandPress, ground: amLight.page, min: TEXT },
  { what: "error text on card", fg: amLight.dangerText, bg: amLight.card, ground: amLight.page, min: TEXT },
  { what: "second heading line on page (large)", fg: amLight.headingSecond, bg: amLight.page, ground: amLight.page, min: PART },
  { what: "progress track on page", fg: amLight.trackOff, bg: amLight.page, ground: amLight.page, min: PART },
  { what: "button outline (lineStrong) on page", fg: amLight.lineStrong, bg: amLight.page, ground: amLight.page, min: PART },
  { what: "field outline (lineStrong) on card", fg: amLight.lineStrong, bg: amLight.card, ground: amLight.page, min: PART },
  { what: "empty radio ring on card", fg: amLight.textMuted, bg: amLight.card, ground: amLight.page, min: PART },
  { what: "filled radio (controlOn) on selected row", fg: amLight.controlOn, bg: lightSel, ground: amLight.card, min: PART },
  { what: "filled radio (controlOn) on card", fg: amLight.controlOn, bg: amLight.card, ground: amLight.page, min: PART },
  { what: "dot on the filled radio", fg: amLight.controlOnDot, bg: amLight.controlOn, ground: amLight.page, min: PART },
  { what: "focus ring on page", fg: amLight.brand, bg: amLight.page, ground: amLight.page, min: PART },
  { what: "focus ring on card", fg: amLight.brand, bg: amLight.card, ground: amLight.page, min: PART },
]

describe("onboarding contrast: every pair of the board, from the real tokens", () => {
  for (const [name, pairs] of [
    ["dark", dark],
    ["light", light],
  ] as const) {
    for (const p of pairs) {
      it(`${name}: ${p.what} reaches ${p.min}:1`, () => {
        expect(ratio(p.fg, p.bg, p.ground)).toBeGreaterThanOrEqual(p.min)
      })
    }
  }
})

describe("onboarding contrast: the accepted dark corrections", () => {
  it("uses the values the board listed", () => {
    expect(amDarkSurface.muted).toBe("#9B958D")
    expect(amDarkSurface.trackOff).toBe("#736D66")
    expect(amDarkSurface.lineStrong).toBe("rgba(255, 255, 255, 0.36)")
    expect(amDarkSurface.controlOn).toBe("#F67931")
    expect(amDarkSurface.controlOnDot).toBe("#121110")
    expect(amDarkSurface.peach).toBe("#3A2418")
    expect(amDark.brand).toBe(amColors.orange700)
  })

  it("matches the numbers printed on the board", () => {
    const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.02)
    near(ratio(amDark.textMuted, D.tile, D.page), 4.79)
    near(ratio(amDark.textMuted, D.peach, D.page), 4.9)
    near(ratio(amDark.trackOff, amDark.page, D.page), 3.69)
    near(ratio(amDark.lineStrong, amDark.card, D.page), 3.32)
    near(ratio(amDark.controlOn, D.peach, D.page), 5.33)
  })

  it("the new tokens exist in both themes", () => {
    for (const key of ["trackOff", "lineStrong", "controlOn", "controlOnDot"] as const) {
      expect(typeof amDark[key]).toBe("string")
      expect(typeof amLight[key]).toBe("string")
    }
  })
})
