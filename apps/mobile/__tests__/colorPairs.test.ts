import { describe, expect, it } from "vitest"

import { amColors, amDark, amDarkSurface, amLight } from "@/constants/tokens/amColors"
import { amColorPairs, amForbiddenPairs, amPairMin } from "@/constants/tokens/amColorPairs"
import { spDark, spLight } from "@/constants/tokens/amSong"
import { protoDark, protoLight } from "@/constants/tokens/amToday"
import { songsTheme } from "@/constants/tokens/amSongs"

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

/** Flatten a possibly translucent colour over an opaque base. */
function flatten(color: string, over: string): Rgb {
  const { rgb, a } = parse(color)
  const base = parse(over).rgb
  return [0, 1, 2].map((i) => Math.round(rgb[i]! * a + base[i]! * (1 - a))) as Rgb
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(fg: string, bg: string, over?: string): number {
  const ground = over ?? (parse(bg).a === 1 ? bg : "#FFFFFF")
  const bgRgb = flatten(bg, ground)
  const fgRgb = flatten(fg, `#${bgRgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`)
  const [hi, lo] = [luminance(fgRgb), luminance(bgRgb)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe("colour system: every allowed pair reaches its minimum", () => {
  for (const p of amColorPairs) {
    it(`${p.theme}: ${p.role} (${p.kind} >= ${amPairMin[p.kind]})`, () => {
      expect(ratio(p.fg, p.bg, p.over)).toBeGreaterThanOrEqual(amPairMin[p.kind])
    })
  }

  it("covers both themes", () => {
    expect(amColorPairs.some((p) => p.theme === "light")).toBe(true)
    expect(amColorPairs.some((p) => p.theme === "dark")).toBe(true)
    expect(amColorPairs.length).toBeGreaterThan(80)
  })
})

describe("colour system: forbidden pairs", () => {
  it("none of them is in the allowed table", () => {
    const allowed = new Set(amColorPairs.filter((p) => p.kind === "text" || p.kind === "largeText").map((p) => `${p.fg.toUpperCase()}|${p.bg.toUpperCase()}`))
    for (const f of amForbiddenPairs) expect(allowed.has(`${f.fg.toUpperCase()}|${f.bg.toUpperCase()}`), f.why).toBe(false)
  })

  it("the ones banned for contrast really fail AA", () => {
    for (const f of amForbiddenPairs.filter((x) => x.reason === "contrast")) {
      expect(ratio(f.fg, f.bg), f.why).toBeLessThan(4.5)
    }
  })

  it("the theme roles never produce a forbidden pair", () => {
    const forbidden = new Set(amForbiddenPairs.map((f) => `${f.fg.toUpperCase()}|${f.bg.toUpperCase()}`))
    for (const theme of [amLight, amDark]) {
      expect(forbidden.has(`${theme.onBrand.toUpperCase()}|${theme.accentBright.toUpperCase()}`)).toBe(true) // the ban exists
      expect(theme.onBrand.toUpperCase()).not.toBe(theme.brand.toUpperCase())
      // the action fill is not the bright orange: white on it must pass, white on bright orange must not
      expect(ratio(theme.onBrand, theme.brand)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(theme.onBrand, theme.accentBright)).toBeLessThan(4.5)
    }
  })
})

describe("colour system: roles of the themes", () => {
  it("action fill is orange700 with white text and orange800 pressed, in both themes", () => {
    for (const t of [amLight, amDark]) {
      expect(t.brand).toBe(amColors.orange700)
      expect(t.brandPress).toBe(amColors.orange800)
      expect(t.onBrand).toBe(amColors.white)
      expect(t.accentBright).toBe(amColors.orange500)
    }
  })

  it("text roles: heading ink800 / body ink600 / muted ink500 in light", () => {
    expect(amLight.textHeading).toBe(amColors.ink800)
    expect(amLight.textBody).toBe(amColors.ink600)
    expect(amLight.textMuted).toBe(amColors.ink500)
    expect(amLight.eyebrow).toBe(amColors.orange800)
    expect(amLight.accentText).toBe(amColors.orange800)
  })

  it("text roles in dark: F4F1EC / A8A29A / 9B958D, accent text orange500", () => {
    expect(amDark.textHeading).toBe("#F4F1EC")
    expect(amDark.textBody).toBe("#A8A29A")
    expect(amDark.textMuted).toBe("#9B958D")
    expect(amDark.accentText).toBe(amColors.orange500)
  })

  it("ink400, ink300 and ink200 are not a text role of any theme", () => {
    const grey = [amColors.ink400, amColors.ink300, amColors.ink200].map((v) => v.toUpperCase())
    const textRoles = (t: Record<string, unknown>, keys: string[]) => keys.map((k) => String(t[k]).toUpperCase())
    const keys = ["textHeading", "textBody", "textMuted", "eyebrow", "accentText", "headingSecond"]
    for (const t of [amLight, amDark]) for (const v of textRoles(t as unknown as Record<string, unknown>, keys)) expect(grey).not.toContain(v)
    for (const t of [songsTheme(amLight, false), songsTheme(amDark, true)]) expect(grey).not.toContain(t.ink300.toUpperCase())
    for (const t of [spLight, spDark, protoLight, protoDark]) expect(grey).not.toContain(t.ink300.toUpperCase())
  })

  it("the proto and song themes carry the same action fill and accent text as AmTheme", () => {
    for (const t of [spLight, spDark, protoLight, protoDark]) {
      expect(t.action).toBe(amColors.orange700)
      expect(t.actionPress).toBe(amColors.orange800)
      expect(t.onAction).toBe(amColors.white)
    }
    // `orange700` in the proto/song themes is the accent TEXT role
    expect(ratio(protoLight.orange700, protoLight.sand200)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(protoLight.orange700, protoLight.orange100)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(protoDark.orange700, amDarkSurface.page)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(spLight.orange700, spLight.sand200)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(spLight.ink300, spLight.sand200)).toBeGreaterThanOrEqual(3)
    expect(ratio(songsTheme(amLight, false).accent, amLight.page)).toBeGreaterThanOrEqual(4.5)
  })
})
