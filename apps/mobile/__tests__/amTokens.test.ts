import { describe, expect, it } from "vitest"

import { amColors, amDark, amLight } from "@/constants/tokens/amColors"
import { amGap, amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFontSize, amFonts } from "@/constants/tokens/amTypography"
import { amReveal, amSpring, projectMomentum, springConfig } from "@/constants/tokens/amMotion"

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe("am design tokens: colour", () => {
  it("keeps the brand values from the site design system", () => {
    expect(amColors.orange500).toBe("#F67931")
    expect(amColors.sand200).toBe("#EEE9E5")
    expect(amColors.sage900).toBe("#20281A")
  })

  it("light theme text reads at WCAG AA on page and card", () => {
    expect(contrast(amLight.textHeading, amLight.page)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(amLight.textHeading, amLight.card)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(amLight.textBody, amLight.card)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(amLight.eyebrow, amLight.card)).toBeGreaterThanOrEqual(4.5)
  })

  it("dark theme text reads at WCAG AA on page, card and inner surface", () => {
    expect(contrast(amDark.textHeading, amDark.page)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(amDark.textHeading, amDark.card)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(amDark.textBody, amDark.card)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(amDark.textBody, amDark.inner)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(amDark.eyebrow, amDark.card)).toBeGreaterThanOrEqual(4.5)
  })

  it("both themes expose the same keys", () => {
    expect(Object.keys(amDark).sort()).toEqual(Object.keys(amLight).sort())
  })
})

describe("am design tokens: spacing", () => {
  it("uses the site's 10px gutter and 20px block gap", () => {
    expect(amGap.gutter).toBe(10)
    expect(amGap.block).toBe(20)
    expect(amGap.text).toBe(15)
  })

  it("has pill, card, panel and sheet radii from the spec", () => {
    expect(amRadius.pill).toBe(70)
    expect(amRadius.card).toBe(20)
    expect(amRadius.panel).toBe(30)
    expect(amRadius.sheet).toBe(40)
  })

  it("keeps the base scale on the 4px grid and the touch target at 44", () => {
    for (const v of Object.values(amSpace)) expect(v % 4).toBe(0)
    expect(amTouchTarget).toBe(44)
  })
})

describe("am design tokens: typography", () => {
  it("uses Roboto, with Noto for Devanagari and Bengali", () => {
    expect(amFonts.display).toBe("Roboto_800ExtraBold")
    expect(amFonts.devanagari).toBe("NotoSansDevanagari_400Regular")
    expect(amFonts.bengali).toBe("NotoSansBengali_400Regular")
  })

  it("follows the 45 / 30 / 24 / 19 / 16 / 13 size steps", () => {
    expect([
      amFontSize.display,
      amFontSize.title,
      amFontSize.heading,
      amFontSize.lead,
      amFontSize.body,
      amFontSize.label,
    ]).toEqual([45, 30, 24, 19, 16, 13])
  })
})

describe("am design tokens: motion", () => {
  it("matches the staggered reveal in the spec", () => {
    expect(amReveal.stepMs).toBe(80)
    expect(amReveal.riseDp).toBe(16)
    expect(amReveal.durationMs).toBe(320)
    expect(amReveal.easing).toEqual([0.2, 0.7, 0.2, 1])
  })

  it("derives spring stiffness and damping from response and damping ratio", () => {
    const { stiffness, damping, mass } = springConfig(0.35, 1)
    expect(mass).toBe(1)
    expect(stiffness).toBeCloseTo((2 * Math.PI) ** 2 / 0.35 ** 2, 5)
    expect(damping).toBeCloseTo((4 * Math.PI) / 0.35, 5)
    expect(amSpring.default).toEqual(springConfig(0.35, 1))
  })

  it("projects where a fling lands", () => {
    expect(projectMomentum(100, 0)).toBe(100)
    expect(projectMomentum(0, 1000)).toBeCloseTo((1000 / 1000) * (0.998 / (1 - 0.998)), 5)
    expect(projectMomentum(50, -500)).toBeLessThan(50)
  })
})
