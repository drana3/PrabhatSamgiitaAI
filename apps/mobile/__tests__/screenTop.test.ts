import { describe, expect, it } from "vitest"

import { FRAME_DEFAULT_INSETS } from "@/lib/framePreview"
import { SCREEN_TOP_FALLBACK, SHEET_BAR_GAP, SHEET_CLOSE_SIZE, SHEET_TOP_MIN_NATIVE, SHEET_TOP_MIN_WEB, screenTopInset, sheetBarHeight, sheetTopInset } from "@/lib/screenTop"

describe("top of a card screen", () => {
  it("uses the reported inset, including the phone frame's", () => {
    expect(screenTopInset(FRAME_DEFAULT_INSETS.top)).toBe(59)
    expect(screenTopInset(47)).toBe(47)
    expect(screenTopInset(24)).toBe(24)
  })

  it("falls back to the 54px status area where no inset is reported (a plain browser tab)", () => {
    expect(screenTopInset(0)).toBe(SCREEN_TOP_FALLBACK)
    expect(SCREEN_TOP_FALLBACK).toBe(54)
  })
})

describe("top of a sheet (modal presentation)", () => {
  it("clears the Dynamic Island in the phone frame: the close button no longer hides behind the status bar", () => {
    const top = sheetTopInset(FRAME_DEFAULT_INSETS.top, "web")
    expect(top).toBe(59)
    // the island ends at 11 + 36 = 47 and the status bar at 59
    expect(top).toBeGreaterThanOrEqual(47)
  })

  it("keeps a minimum in a plain browser tab and on a phone that reports no inset", () => {
    expect(sheetTopInset(0, "web")).toBe(SHEET_TOP_MIN_WEB)
    expect(sheetTopInset(0, "ios")).toBe(SHEET_TOP_MIN_NATIVE)
    expect(sheetTopInset(0, "android")).toBe(SHEET_TOP_MIN_NATIVE)
  })

  it("uses the real inset on a phone when it is larger than the minimum", () => {
    expect(sheetTopInset(47, "ios")).toBe(47)
    expect(sheetTopInset(8, "ios")).toBe(SHEET_TOP_MIN_NATIVE)
  })

  it("reserves a row for the close button, so text starts below it", () => {
    expect(sheetBarHeight(59)).toBe(59 + SHEET_CLOSE_SIZE + SHEET_BAR_GAP)
    expect(sheetBarHeight(59)).toBeGreaterThan(59 + SHEET_CLOSE_SIZE)
  })
})
