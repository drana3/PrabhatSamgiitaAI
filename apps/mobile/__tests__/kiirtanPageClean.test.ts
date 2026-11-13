import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { kiirtanHubEn, kiirtanHubEs, kiirtanHubRu } from "@/locales/kiirtanHub"

/** Dada, 12 Nov 2026: the Kiirtan page reads top to bottom with no repeats; "Browse all" is one tile block, one key. */

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8")
const tab = read("app/kiirtan.tsx")

describe("the Browse all block", () => {
  it("has its working title in ONE locale key, in three languages, and the page reads only that key", () => {
    expect(kiirtanHubEn["kh.cat.title"]).toBe("Browse all")
    expect(kiirtanHubRu["kh.cat.title"]).toBeTruthy()
    expect(kiirtanHubEs["kh.cat.title"]).toBeTruthy()
    expect(tab).toContain('t("kh.cat.title")')
    expect(tab).not.toMatch(/kh\.cat\.(eyebrow|first|second)/)
    expect(Object.keys(kiirtanHubEn).filter((k) => /^kh\.cat\.(eyebrow|first|second)$/.test(k))).toEqual([])
  })

  it("is a mosaic of two columns of tiles of different heights, not a vertical list", () => {
    const cards = read("components/kirtan/hub/KindCards.tsx")
    expect(cards).toMatch(/const TILE_H = \[(\d+), (\d+), (\d+), (\d+), (\d+), (\d+)\]/)
    const heights = (cards.match(/const TILE_H = \[([^\]]+)\]/)?.[1] ?? "").split(",").map(Number)
    expect(new Set(heights).size).toBeGreaterThan(2)
    // both columns end at the same height
    expect(heights[0]! + heights[2]! + heights[4]!).toBe(heights[1]! + heights[3]! + heights[5]!)
    expect(cards).toContain("i % 2 === 0")
    expect(cards).toContain("i % 2 === 1")
    expect(cards).toMatch(/mosaic: \{ flexDirection: "row"/)
    expect(cards).toMatch(/column: \{ flex: 1/)
  })
})

describe("the Kiirtan page, top to bottom", () => {
  const at = (needle: string) => {
    const i = tab.indexOf(needle)
    expect(i, needle).toBeGreaterThan(0)
    return i
  }

  it("reads: strip, day, jump back in, most played, browse all, live, new recordings, authors, piano, every hour, long, mine", () => {
    const order = ["{nowStrip()}", "<DayCard kirtan={day}", 't("kt.jump.eyebrow")', "<MostPlayedCard", "<KindCards", "<BroadcastsShelf", 't("kt.new.eyebrow")', "<AuthorsShelf", 't("kt.piano.eyebrow")', 'kind === "all" ? hourShelf()', 't("kh.long.first")']
    const positions = order.map(at)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(tab.lastIndexOf("{mineTiles()}")).toBeGreaterThan(positions[positions.length - 1]!)
  })

  it("shows each thing once: one day card, the broadcast on the air once, the length chips with the list they narrow", () => {
    expect(tab.match(/<DayCard kirtan=/g)).toHaveLength(1)
    expect(tab).not.toContain("bhajanDay")
    expect(tab).not.toContain("LiveCard")
    expect(tab).not.toContain("useKirtanLive")
    expect(tab).toContain("liveBroadcasts.filter((b) => b !== onAir)")
    expect(tab).not.toContain('t("kt.length.eyebrow")')
    // the chips sit between the head of New recordings and its rows
    expect(at("LENGTH_BUCKETS.map")).toBeGreaterThan(at('t("kt.new.eyebrow")'))
    expect(at("LENGTH_BUCKETS.map")).toBeLessThan(at("list.map((k) => <KirtanRow"))
  })

  it("keeps the working screens: Saved, My uploads, Play all, the list filters, the chips of the kinds", () => {
    expect(tab).toContain("<MineTiles")
    expect(tab).toContain('kiirtanListHref({ mode: "saved" })')
    expect(tab).toContain('kiirtanListHref({ mode: "mine" })')
    expect(tab).toContain("subFilters()")
    expect(tab).toContain("practiceChoice()")
    expect(tab).toContain("StickyChipsRow")
    expect(tab).toContain("playEverything()")
  })
})
