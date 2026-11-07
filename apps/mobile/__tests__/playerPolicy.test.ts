import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

import { amNav } from "@/constants/tokens/amNav"
import { NAV_V2_MINI_HIDDEN_PREFIXES, NAV_V2_TABS, SCROLL_AIR, contentInsetFor, miniBottomFor, miniPlayerVisible, navV2Layout, scrollBottomInset, tabBarVisible } from "@/lib/navV2"
import { DEFAULT_ROW, HIDDEN_MINI_PREFIXES, PLAYER_POLICY, miniModeForPath, policyForPath } from "@/lib/playerPolicy"

const SAFE = 34

describe("player policy table", () => {
  it("has unique ids and no route prefix in two rows", () => {
    expect(new Set(PLAYER_POLICY.map((r) => r.id)).size).toBe(PLAYER_POLICY.length)
    const all = PLAYER_POLICY.flatMap((r) => r.prefixes)
    expect(new Set(all).size).toBe(all.length)
  })

  it("keeps its two switches consistent: the tab bar only carries the pill above it; a hidden screen has no tab bar", () => {
    for (const row of PLAYER_POLICY) {
      if (row.tabBar) expect(row.mini, row.id).toBe("above-tab-bar")
      if (row.mini === "above-tab-bar") expect(row.tabBar, row.id).toBe(true)
      if (row.mini === "hidden") expect(row.tabBar, row.id).toBe(false)
      expect(row.why.length, row.id).toBeGreaterThan(10)
    }
  })

  it("resolves every prefix, and a sub-route of it, to its own row", () => {
    for (const row of PLAYER_POLICY) {
      for (const prefix of row.prefixes) {
        expect(policyForPath(prefix).id, prefix).toBe(row.id)
        expect(policyForPath(`${prefix}/x?y=1`).id, prefix).toBe(row.id)
      }
      expect(policyForPath(row.sample).id, row.sample).toBe(row.id)
    }
  })

  it("matches by segment, so /kiirtan is a browsing page and /kiirtan-live is hidden", () => {
    expect(miniModeForPath("/kiirtan")).toBe("above-bottom")
    expect(miniModeForPath("/kiirtan-live")).toBe("hidden")
    expect(miniModeForPath("/upload")).toBe("hidden")
    expect(miniModeForPath("/upload-chords")).toBe("hidden")
    expect(policyForPath("/something-new")).toBe(DEFAULT_ROW)
  })
})

describe("the code follows the table", () => {
  it("shows the pill exactly where the table says, and never with nothing loaded", () => {
    for (const row of PLAYER_POLICY) {
      expect(miniPlayerVisible({ pathname: row.sample, hasSong: true }), row.id).toBe(row.mini !== "hidden")
      expect(miniPlayerVisible({ pathname: row.sample, hasSong: false }), row.id).toBe(false)
    }
    expect(miniPlayerVisible({ pathname: DEFAULT_ROW.sample, hasSong: true })).toBe(true)
  })

  it("shows the tab bar (and its Upload button) exactly where the table says", () => {
    for (const row of PLAYER_POLICY) expect(tabBarVisible(row.sample), row.id).toBe(row.tabBar)
    expect(tabBarVisible(DEFAULT_ROW.sample)).toBe(false)
  })

  it("reads the hidden list of lib/navV2 from the table", () => {
    expect(NAV_V2_MINI_HIDDEN_PREFIXES).toEqual(HIDDEN_MINI_PREFIXES)
    expect(HIDDEN_MINI_PREFIXES).toEqual(PLAYER_POLICY.filter((r) => r.mini === "hidden").flatMap((r) => r.prefixes))
  })

  it("puts the four tabs of the shell in the tab rows", () => {
    const tabPrefixes = PLAYER_POLICY.filter((r) => r.group === "tab").flatMap((r) => r.prefixes)
    for (const tab of NAV_V2_TABS) expect(tabPrefixes).toContain(tab.href)
  })

  it("sits the pill above the tab bar on a tab row and above the bottom edge on the others", () => {
    for (const row of PLAYER_POLICY.filter((r) => r.mini !== "hidden")) {
      const bottom = miniBottomFor(SAFE, tabBarVisible(row.sample))
      expect(bottom, row.id).toBe(row.mini === "above-tab-bar" ? navV2Layout(SAFE).miniBottom : navV2Layout(SAFE).tabBottom)
    }
  })

  it("clears the last line of every page by the pill that the table says is there", () => {
    for (const row of PLAYER_POLICY) {
      const pad = scrollBottomInset({ safeBottom: SAFE, pathname: row.sample, hasSong: true })
      if (row.mini === "above-tab-bar") expect(pad, row.id).toBe(contentInsetFor(SAFE, true))
      else if (row.mini === "above-bottom") expect(pad, row.id).toBe(SAFE + amNav.miniHeight + amNav.gap + SCROLL_AIR)
      else expect(pad, row.id).toBe(SAFE + SCROLL_AIR)
      // the pad is at least the pill's top edge plus air, so the last line can be read
      if (row.mini !== "hidden") expect(pad, row.id).toBeGreaterThanOrEqual(miniBottomFor(SAFE, row.tabBar) + amNav.miniHeight + amNav.gap)
    }
  })

  it("adds no room on a phone without a home indicator beyond the minimum gap, and keeps the pill room", () => {
    expect(scrollBottomInset({ safeBottom: 0, pathname: "/library-v2", hasSong: true })).toBe(amNav.tabBottom + amNav.miniHeight + amNav.gap + SCROLL_AIR)
    expect(scrollBottomInset({ safeBottom: 0, pathname: "/content-rules", hasSong: true })).toBe(amNav.tabBottom + SCROLL_AIR)
  })
})

describe("every screen has a decision", () => {
  // Pushed screens of the team that fall to the default (the pill above the bottom edge) on purpose.
  const DEFAULT_OK = new Set(["/about", "/parity", "/drive", "/search", "/admin", "/(tabs)", "/index", "/today"])

  function routes(dir: string, base = dir): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) return routes(full, base)
      if (!/\.tsx$/.test(name) || /^_layout|^\+/.test(name)) return []
      const path = "/" + relative(base, full).replace(/\.tsx$/, "").replace(/\/index$/, "").replace(/^index$/, "")
      return [path.replace(/\[[^\]]+\]/g, "x")]
    })
  }

  it("covers every route file by a row, or lists it as a default on purpose", () => {
    const app = join(__dirname, "..", "app")
    const undecided = routes(app)
      .filter((path) => !path.startsWith("/v2/") && !path.startsWith("/(tabs)") && path !== "/")
      .filter((path) => policyForPath(path) === DEFAULT_ROW)
      .filter((path) => !DEFAULT_OK.has(path) && ![...DEFAULT_OK].some((ok) => path.startsWith(`${ok}/`)))
    expect(undecided).toEqual([])
  })
})

describe("docs/player-visibility.md", () => {
  const text = readFileSync(join(__dirname, "..", "..", "..", "docs", "player-visibility.md"), "utf8")
  const MINI = { "above-tab-bar": "Shown above the tab bar", "above-bottom": "Shown above the bottom edge", hidden: "Hidden" } as const
  const cells = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim())
  const rows = text.split("\n").filter((l) => l.startsWith("| ") && l.includes("`/")).map(cells)

  it("holds the table of the code, row for row", () => {
    expect(rows).toHaveLength(PLAYER_POLICY.length)
    PLAYER_POLICY.forEach((row, index) => {
      const [title, routesCell, mini, tabBar, why] = rows[index] as string[]
      expect(title).toBe(row.title)
      expect(routesCell).toBe(row.prefixes.map((p) => `\`${p}\``).join(", "))
      expect(mini).toBe(MINI[row.mini])
      expect(tabBar).toBe(row.tabBar ? "Shown" : "Not shown")
      expect(why).toBe(row.why)
    })
  })
})
