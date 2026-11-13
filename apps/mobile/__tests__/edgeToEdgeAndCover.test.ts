import { beforeEach, describe, expect, it } from "vitest"

import { amNav } from "@/constants/tokens/amNav"
import { FRAME_DEFAULT_INSETS, parseFrameInsets } from "@/lib/framePreview"
import { SCROLL_AIR, miniBottomFor, navV2Layout, scrollBottomInset } from "@/lib/navV2"
import { coverSheet, sheetIsOpen, useSheetCover } from "@/lib/sheetCover"

describe("preview frame insets (edge to edge)", () => {
  it("is null outside the phone frame", () => {
    expect(parseFrameInsets(null)).toBeNull()
    expect(parseFrameInsets(undefined)).toBeNull()
    expect(parseFrameInsets({})).toBeNull()
  })

  it("reads top and bottom from the frame, 0 on the sides", () => {
    expect(parseFrameInsets({ safeTop: "59", safeBottom: "34" })).toEqual({ top: 59, bottom: 34, left: 0, right: 0 })
    expect(parseFrameInsets({ safeTop: "47", safeBottom: "0" })).toEqual({ top: 47, bottom: 0, left: 0, right: 0 })
  })

  it("falls back to the iPhone defaults for a missing or broken value", () => {
    expect(parseFrameInsets({ safeTop: "59" })?.bottom).toBe(FRAME_DEFAULT_INSETS.bottom)
    expect(parseFrameInsets({ safeTop: "abc", safeBottom: "-4" })).toMatchObject({ top: 59, bottom: 34 })
    expect(FRAME_DEFAULT_INSETS).toMatchObject({ top: 59, bottom: 34 })
  })
})

describe("bottom padding rule for long pages", () => {
  it("tab screen: clears the tab pill, plus the mini-player while one shows", () => {
    const safe = 34
    expect(scrollBottomInset({ safeBottom: safe, pathname: "/v2/today", hasSong: false })).toBe(safe + amNav.tabHeight + amNav.gap)
    expect(scrollBottomInset({ safeBottom: safe, pathname: "/v2/today", hasSong: true })).toBe(navV2Layout(safe).contentInset)
  })

  it("pushed screen: safe area, the mini-player while one shows, and air", () => {
    const safe = 34
    expect(scrollBottomInset({ safeBottom: safe, pathname: "/stories", hasSong: false })).toBe(safe + SCROLL_AIR)
    const withMini = scrollBottomInset({ safeBottom: safe, pathname: "/stories", hasSong: true })
    expect(withMini).toBe(safe + amNav.miniHeight + amNav.gap + SCROLL_AIR)
    // the pill sits at miniBottomFor and is miniHeight tall: the last row ends above it
    expect(withMini).toBeGreaterThan(miniBottomFor(safe, false) + amNav.miniHeight)
  })

  it("uses the minimum bottom gap on a device without a home indicator", () => {
    expect(scrollBottomInset({ safeBottom: 0, pathname: "/stories", hasSong: true })).toBe(amNav.tabBottom + amNav.miniHeight + amNav.gap + SCROLL_AIR)
  })

  it("adds no mini-player room where the mini-player never shows (full player, sign-in, sheets)", () => {
    const bare = 34 + SCROLL_AIR
    expect(scrollBottomInset({ safeBottom: 34, pathname: "/player-v2", hasSong: true })).toBe(bare)
    expect(scrollBottomInset({ safeBottom: 34, pathname: "/signin", hasSong: true })).toBe(bare)
  })
})

describe("sheet cover (mini-player slides away while a sheet is open)", () => {
  beforeEach(() => useSheetCover.setState({ count: 0 }))

  it("counts open sheets and nests", () => {
    expect(sheetIsOpen()).toBe(false)
    const a = coverSheet()
    const b = coverSheet()
    expect(useSheetCover.getState().count).toBe(2)
    a()
    expect(sheetIsOpen()).toBe(true)
    b()
    expect(sheetIsOpen()).toBe(false)
  })

  it("a release called twice does not close a second sheet", () => {
    const a = coverSheet()
    const b = coverSheet()
    a()
    a()
    expect(useSheetCover.getState().count).toBe(1)
    b()
    expect(useSheetCover.getState().count).toBe(0)
  })
})
