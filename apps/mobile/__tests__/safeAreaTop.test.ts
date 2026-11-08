import { beforeEach, describe, expect, it, vi } from "vitest"

// An iPhone 15 Pro: the Dynamic Island ends at 47 and the status bar at 59.
const IPHONE = { top: 59, bottom: 34, left: 0, right: 0 }
let insets = { ...IPHONE }
let os = "ios"

vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => insets }))
vi.mock("react-native", () => ({
  get Platform() {
    return { OS: os }
  },
}))

import { useScreenTop, useSheetTop } from "@/hooks/useScreenTop"
import { MODAL_HEADER_MIN_HEIGHT, SHEET_CLOSE_SIZE, modalHeaderTop, sheetBarHeight } from "@/lib/screenTop"

beforeEach(() => {
  insets = { ...IPHONE }
  os = "ios"
})

describe("the top of a screen on an iPhone with a Dynamic Island (inset top 59)", () => {
  it("a page starts below the island", () => {
    expect(useScreenTop()).toBe(59)
  })

  it("a sheet (Upload, Add recording) starts below the island", () => {
    expect(useSheetTop()).toBe(59)
  })

  it("the title row of a picker sheet (song chooser, language list) starts below the island, not at 8", () => {
    const top = modalHeaderTop(insets.top, "ios")
    expect(top).toBe(59)
    // the island ends at 47: the title and the close button are clear of it and of the clock
    expect(top).toBeGreaterThanOrEqual(47)
  })

  it("the close button of a picker sheet is clear of the battery: it sits in the row below the status bar", () => {
    const top = modalHeaderTop(insets.top, "ios")
    const rowTop = top
    expect(rowTop).toBeGreaterThanOrEqual(insets.top)
    expect(MODAL_HEADER_MIN_HEIGHT).toBeGreaterThanOrEqual(SHEET_CLOSE_SIZE + 16)
  })

  it("an older iPhone (47) and an Android phone with no cut-out (24) are cleared too", () => {
    insets = { ...IPHONE, top: 47 }
    expect(useSheetTop()).toBe(47)
    insets = { ...IPHONE, top: 24 }
    os = "android"
    expect(useSheetTop()).toBe(24)
  })

  it("a sheet inside which the system reports nothing (0) still keeps a minimum for the grabber", () => {
    expect(modalHeaderTop(0, "ios")).toBeGreaterThanOrEqual(16)
    expect(modalHeaderTop(0, "web")).toBeGreaterThanOrEqual(24)
  })

  it("the phone frame of the browser preview (web, inset 59) gives the same 59", () => {
    os = "web"
    expect(useSheetTop()).toBe(59)
    expect(useScreenTop()).toBe(59)
  })

  it("the row of a route sheet reserves its close button below the island", () => {
    expect(sheetBarHeight(useSheetTop())).toBe(59 + SHEET_CLOSE_SIZE + 6)
  })
})
