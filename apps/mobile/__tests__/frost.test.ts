import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { frostFallbackColor } from "@/lib/frost"

describe("frost fallback (Android has no cheap backdrop blur)", () => {
  it("is more opaque with a stronger intensity and respects the tint", () => {
    const alphaOf = (c: string) => Number(/, ([\d.]+)\)$/.exec(c)![1])
    expect(alphaOf(frostFallbackColor("dark", 80))).toBeGreaterThan(alphaOf(frostFallbackColor("dark", 20)))
    expect(frostFallbackColor("dark", 40)).toMatch(/^rgba\(20, 18, 16,/)
    expect(frostFallbackColor("light", 40)).toMatch(/^rgba\(255, 255, 255,/)
  })

  it("keeps the fill translucent but readable for any intensity", () => {
    for (const intensity of [-10, 0, 50, 100, 400]) {
      const alpha = Number(/, ([\d.]+)\)$/.exec(frostFallbackColor("light", intensity))![1])
      expect(alpha).toBeGreaterThanOrEqual(0.45)
      expect(alpha).toBeLessThanOrEqual(0.85)
    }
  })

  it("is used instead of a bare BlurView on the player, Today and tab bar surfaces", () => {
    for (const file of [
      "components/today/TodayBlocks.tsx",
      "components/player-v2/LyricsPanel.tsx",
      "components/player-v2/VersionControls.tsx",
      "components/player-v2/DriveControls.tsx",
      "components/nav-v2/FloatingTabBar.tsx",
      "components/nav-v2/MiniPlayerPill.tsx",
      "components/today/TodayPrototypeScreen.tsx",
    ]) {
      const source = readFileSync(path.resolve(__dirname, "..", file), "utf8")
      expect(source, file).toContain("<Frost")
      expect(source, file).not.toContain("<BlurView")
    }
  })
})
