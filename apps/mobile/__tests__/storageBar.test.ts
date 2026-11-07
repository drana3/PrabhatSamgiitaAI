import { describe, expect, it } from "vitest"

import { amNav } from "@/constants/tokens/amNav"
import { STORAGE_BAR_HEIGHT, storageBarBottom, storageListInset } from "@/lib/storageBar"

describe("storageBarBottom", () => {
  it("floats low when nothing else is at the bottom", () => {
    expect(storageBarBottom({ safeBottom: 0, miniVisible: false, tabBarVisible: false })).toBe(28)
    expect(storageBarBottom({ safeBottom: 34, miniVisible: false, tabBarVisible: false })).toBe(42)
  })

  it("sits above the mini-player on a pushed screen", () => {
    const bottom = storageBarBottom({ safeBottom: 0, miniVisible: true, tabBarVisible: false })
    // the mini-player occupies tabBottom .. tabBottom + miniHeight
    expect(bottom).toBeGreaterThanOrEqual(amNav.tabBottom + amNav.miniHeight)
    expect(bottom).toBe(amNav.tabBottom + amNav.miniHeight + 12)
  })

  it("clears the safe area under the mini-player", () => {
    const bottom = storageBarBottom({ safeBottom: 34, miniVisible: true, tabBarVisible: false })
    expect(bottom).toBe(34 + amNav.miniHeight + 12)
  })

  it("sits above the tab bar and the mini-player when both show", () => {
    const bottom = storageBarBottom({ safeBottom: 0, miniVisible: true, tabBarVisible: true })
    expect(bottom).toBe(amNav.tabBottom + amNav.tabHeight + amNav.gap + amNav.miniHeight + 12)
  })

  it("sits above the tab bar alone", () => {
    expect(storageBarBottom({ safeBottom: 0, miniVisible: false, tabBarVisible: true })).toBe(
      amNav.tabBottom + amNav.tabHeight + 12,
    )
  })
})

describe("storageListInset", () => {
  it("leaves room for the pill and some air", () => {
    expect(storageListInset(88)).toBe(88 + STORAGE_BAR_HEIGHT + 24)
  })
})
