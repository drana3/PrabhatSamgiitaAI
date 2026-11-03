import { describe, expect, it } from "vitest"

import { amDark, amLight } from "@/constants/tokens/amColors"
import { amNav } from "@/constants/tokens/amNav"
import {
  NAV_V2_MINI_EXTRA_PREFIXES,
  NAV_V2_PROFILE_SHEET_ROUTE,
  NAV_V2_TABS,
  formatClock,
  hexAlpha,
  indicatorXFor,
  isDarkTheme,
  miniPillPalette,
  miniPlayerVisible,
  miniProgress,
  navV2Layout,
  releaseSpringKind,
  miniSubtitle,
  pathHasPrefix,
  pillVariantFor,
  rubberBand,
  settleTabIndex,
  tabIdForPath,
  tabIndexAtX,
  tabIndexForId,
  tabPillPalette,
  tabWidthFor,
} from "@/lib/navV2"

describe("nav v2: tab config", () => {
  it("has the four tabs of spec 2.1 in order", () => {
    expect(NAV_V2_TABS.map((t) => t.id)).toEqual(["today", "songs", "player", "learn"])
    expect(NAV_V2_TABS.map((t) => t.label)).toEqual(["Today", "Songs", "Player", "Learn"])
  })

  it("keeps ids, screens and hrefs unique and inside the v2 shell", () => {
    expect(new Set(NAV_V2_TABS.map((t) => t.id)).size).toBe(4)
    expect(new Set(NAV_V2_TABS.map((t) => t.screen)).size).toBe(4)
    expect(new Set(NAV_V2_TABS.map((t) => t.href)).size).toBe(4)
    for (const tab of NAV_V2_TABS) expect(tab.href).toBe(`/v2/${tab.screen}`)
  })

  it("never lets two tabs own the same path prefix", () => {
    const all = NAV_V2_TABS.flatMap((t) => t.owns)
    expect(new Set(all).size).toBe(all.length)
  })

  it("names the profile sheet route", () => {
    expect(NAV_V2_PROFILE_SHEET_ROUTE).toMatch(/^\//)
  })

  it("finds the index of a tab id", () => {
    expect(tabIndexForId("today")).toBe(0)
    expect(tabIndexForId("learn")).toBe(3)
  })
})

describe("nav v2: path matching", () => {
  it("matches segments, not substrings", () => {
    expect(pathHasPrefix("/song/12", "/song")).toBe(true)
    expect(pathHasPrefix("/songs", "/song")).toBe(false)
    expect(pathHasPrefix("/song", "/song")).toBe(true)
    expect(pathHasPrefix("/songs/", "/songs")).toBe(true)
    expect(pathHasPrefix("/today?x=1", "/today")).toBe(true)
  })

  it("maps shell and legacy-redesign paths to a tab", () => {
    expect(tabIdForPath("/v2/today")).toBe("today")
    expect(tabIdForPath("/today")).toBe("today")
    expect(tabIdForPath("/v2/songs")).toBe("songs")
    expect(tabIdForPath("/collections")).toBe("songs")
    expect(tabIdForPath("/v2/player")).toBe("player")
    expect(tabIdForPath("/player")).toBe("player")
    expect(tabIdForPath("/stories/abc")).toBe("learn")
    expect(tabIdForPath("/search")).toBeNull()
    expect(tabIdForPath("/")).toBeNull()
  })
})

describe("nav v2: mini-player visibility", () => {
  const visible = (pathname: string, hasSong = true) => miniPlayerVisible({ pathname, hasSong })

  it("shows on Today, Songs and Learn when a song is loaded", () => {
    expect(visible("/v2/today")).toBe(true)
    expect(visible("/v2/songs")).toBe(true)
    expect(visible("/v2/learn")).toBe(true)
    expect(visible("/stories/abc")).toBe(true)
  })

  it("shows on the Song page", () => {
    expect(NAV_V2_MINI_EXTRA_PREFIXES).toContain("/song")
    expect(visible("/song/42")).toBe(true)
  })

  it("is hidden on the Player tab", () => {
    expect(visible("/v2/player")).toBe(false)
    expect(visible("/player")).toBe(false)
  })

  it("is hidden when nothing is loaded", () => {
    expect(visible("/v2/today", false)).toBe(false)
    expect(visible("/song/42", false)).toBe(false)
  })

  it("is hidden on screens outside the tabs and the Song page", () => {
    expect(visible("/search")).toBe(false)
    expect(visible("/auth")).toBe(false)
  })
})

describe("nav v2: pill variant", () => {
  it("turns dark only on the Player tab", () => {
    expect(pillVariantFor("player")).toBe("dark")
    expect(pillVariantFor("today")).toBe("light")
    expect(pillVariantFor("songs")).toBe("light")
    expect(pillVariantFor("learn")).toBe("light")
  })
})

describe("nav v2: tab geometry", () => {
  const width = 80
  it("splits the tray into equal slots", () => {
    expect(tabWidthFor(320, 4)).toBe(80)
    expect(tabWidthFor(-5, 4)).toBe(0)
    expect(tabWidthFor(320, 0)).toBe(0)
    expect(indicatorXFor(2, width)).toBe(160)
  })

  it("finds the slot under a touch and clamps outside the tray", () => {
    expect(tabIndexAtX(0, width, 4)).toBe(0)
    expect(tabIndexAtX(79, width, 4)).toBe(0)
    expect(tabIndexAtX(80, width, 4)).toBe(1)
    expect(tabIndexAtX(319, width, 4)).toBe(3)
    expect(tabIndexAtX(-40, width, 4)).toBe(0)
    expect(tabIndexAtX(900, width, 4)).toBe(3)
    expect(tabIndexAtX(10, 0, 4)).toBe(0)
  })
})

describe("nav v2: settling after a drag (momentum projection)", () => {
  const input = (indicatorX: number, velocity: number) => ({ indicatorX, velocity, tabWidth: 80, count: 4 })

  it("stays put on a still release inside the slot", () => {
    expect(settleTabIndex(input(0, 0))).toBe(0)
    expect(settleTabIndex(input(30, 0))).toBe(0)
  })

  it("picks the nearest tab by centre with no velocity", () => {
    // indicator left edge 50 -> centre 90 -> slot 1
    expect(settleTabIndex(input(50, 0))).toBe(1)
    // left edge 120 -> centre 160 -> slot 2
    expect(settleTabIndex(input(120, 0))).toBe(2)
  })

  it("a flick carries the indicator beyond the finger", () => {
    // centre 40 + (200/1000)*499 = 139.8 -> slot 1
    expect(settleTabIndex(input(0, 200))).toBe(1)
    // a hard flick lands on the last tab, clamped
    expect(settleTabIndex(input(0, 1500))).toBe(3)
  })

  it("a flick to the left goes the other way and clamps at the first tab", () => {
    expect(settleTabIndex(input(240, -200))).toBe(2)
    expect(settleTabIndex(input(240, -1500))).toBe(0)
  })

  it("a slow drag over the line is decided by the projection, not the distance", () => {
    // centre 100 (slot 1) but moving left at 100 px/s: 100 - 49.9 = 50.1 -> slot 0
    expect(settleTabIndex(input(60, -100))).toBe(0)
  })

  it("handles degenerate geometry", () => {
    expect(settleTabIndex({ indicatorX: 10, velocity: 500, tabWidth: 0, count: 4 })).toBe(0)
    expect(settleTabIndex({ indicatorX: 10, velocity: 500, tabWidth: 80, count: 0 })).toBe(0)
  })
})

describe("nav v2: rubber band", () => {
  it("is 1:1 inside the limits", () => {
    expect(rubberBand(100, 0, 240, 320)).toBe(100)
    expect(rubberBand(0, 0, 240, 320)).toBe(0)
    expect(rubberBand(240, 0, 240, 320)).toBe(240)
  })

  it("resists past the limits and never reaches the dimension", () => {
    const over = rubberBand(300, 0, 240, 320)
    expect(over).toBeGreaterThan(240)
    expect(over - 240).toBeLessThan(60)
    const under = rubberBand(-60, 0, 240, 320)
    expect(under).toBeLessThan(0)
    expect(-under).toBeLessThan(60)
    expect(rubberBand(1_000_000, 0, 240, 320)).toBeLessThan(240 + 320)
  })

  it("is monotonic", () => {
    expect(rubberBand(280, 0, 240, 320)).toBeGreaterThan(rubberBand(260, 0, 240, 320))
  })

  it("falls back to a hard clamp without a dimension", () => {
    expect(rubberBand(300, 0, 240, 0)).toBe(240)
  })
})

describe("nav v2: colours from tokens", () => {
  it("turns hex into rgba", () => {
    expect(hexAlpha("#FFFFFF", 0.38)).toBe("rgba(255, 255, 255, 0.38)")
    expect(hexAlpha("#20281A", 0.42)).toBe("rgba(32, 40, 26, 0.42)")
  })

  it("mini-player: white at 38% in Light, forest at 42% in Dark", () => {
    expect(isDarkTheme(amLight)).toBe(false)
    expect(isDarkTheme(amDark)).toBe(true)
    expect(miniPillPalette(amLight).background).toBe("rgba(255, 255, 255, 0.38)")
    expect(miniPillPalette(amDark).background).toBe("rgba(32, 40, 26, 0.42)")
    expect(amNav.miniBlur).toBe(24)
  })

  it("tab pill: glass in light, forest on the Player", () => {
    expect(tabPillPalette(amLight, "light").background).toBe(amLight.glassStrong)
    expect(tabPillPalette(amLight, "dark").background).toBe("rgba(32, 40, 26, 0.78)")
    expect(tabPillPalette(amLight, "dark").inactive).toBe("rgba(255, 255, 255, 0.78)")
    expect(amNav.tabBlur).toBe(14)
  })
})

describe("nav v2: mini-player text", () => {
  it("formats clocks", () => {
    expect(formatClock(0)).toBe("0:00")
    expect(formatClock(65)).toBe("1:05")
    expect(formatClock(-3)).toBe("0:00")
    expect(formatClock(Number.NaN)).toBe("0:00")
  })

  it("clamps progress and hides an unknown duration", () => {
    expect(miniProgress(30, 120)).toBe(0.25)
    expect(miniProgress(200, 120)).toBe(1)
    expect(miniProgress(5, 0)).toBe(0)
    expect(miniSubtitle({ number: 12, position: 65, duration: 271 })).toBe("PS 12 · 1:05 of 4:31")
    expect(miniSubtitle({ number: 12, position: 65, duration: 0 })).toBe("PS 12")
  })
})

describe("nav v2: release spring and layout", () => {
  it("overshoots only when the gesture carried momentum", () => {
    expect(releaseSpringKind(0)).toBe("default")
    expect(releaseSpringKind(-300)).toBe("default")
    expect(releaseSpringKind(900)).toBe("fling")
    expect(releaseSpringKind(-900)).toBe("fling")
  })

  it("stacks the mini-player above the tab pill with the 12px gap", () => {
    const flat = navV2Layout(0)
    expect(flat.tabBottom).toBe(12)
    expect(flat.miniBottom).toBe(12 + 68 + 12)
    expect(flat.contentInset).toBe(flat.miniBottom + 64 + 12)
    const notch = navV2Layout(34)
    expect(notch.tabBottom).toBe(34)
    expect(notch.miniBottom).toBe(34 + 68 + 12)
  })
})
