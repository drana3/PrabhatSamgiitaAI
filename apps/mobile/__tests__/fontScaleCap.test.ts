import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { MAX_FONT_SCALE } from "@/constants/fontScale"

/** Surfaces with a fixed height: text must stop growing at MAX_FONT_SCALE instead of being clipped. */
const FIXED_HEIGHT_SURFACES = [
  "components/songs-v2/SongCardRow.tsx",
  "components/songs-v2/ListParts.tsx",
  "components/songs-v2/PlaylistSongRow.tsx",
  "components/songs-v2/Pill.tsx",
  "components/songs-v2/primitives.tsx",
  "components/songs-v2/FastScrollRail.tsx",
  "components/nav-v2/FloatingTabBar.tsx",
  "components/nav-v2/StickyChips.tsx",
]

describe("font scale cap on fixed-height surfaces", () => {
  it("is a sane multiplier", () => {
    expect(MAX_FONT_SCALE).toBeGreaterThan(1)
    expect(MAX_FONT_SCALE).toBeLessThanOrEqual(1.5)
  })

  it.each(FIXED_HEIGHT_SURFACES)("%s caps every <Text>", (file) => {
    const source = readFileSync(path.resolve(__dirname, "..", file), "utf8")
    const tags = [...source.matchAll(/<Text(?=[\s>])[^>]*>/g)].map((m) => m[0])
    expect(tags.length).toBeGreaterThan(0)
    for (const tag of tags) expect(tag).toContain("maxFontSizeMultiplier")
  })
})
