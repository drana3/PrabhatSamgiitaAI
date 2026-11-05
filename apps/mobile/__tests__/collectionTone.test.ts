import { describe, expect, it } from "vitest"

import { amColors } from "@/constants/tokens/amColors"
import { COLLECTION_TONES, collectionTone } from "@/lib/songsV2/collectionTone"
import { KIND_ORDER } from "@/lib/songsV2/collectionsIndex"

function channel(v: number) {
  const x = v / 255
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}
function whiteContrast(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const lum = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  return 1.05 / (lum + 0.05)
}

describe("collection card tones", () => {
  it("has a tone for every collection kind", () => {
    for (const kind of KIND_ORDER) expect(COLLECTION_TONES[kind].length).toBeGreaterThan(0)
    expect(COLLECTION_TONES.mood.length).toBeGreaterThan(0)
  })
  it("gives white text 4.5:1 on both ends of every gradient", () => {
    for (const kind of Object.keys(COLLECTION_TONES) as (keyof typeof COLLECTION_TONES)[]) {
      for (const [from, to] of COLLECTION_TONES[kind]) {
        expect(whiteContrast(from), `${kind} ${from}`).toBeGreaterThanOrEqual(4.5)
        expect(whiteContrast(to), `${kind} ${to}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
  it("picks among a kind's pairs by index, wrapping and ignoring bad indexes", () => {
    const pairs = COLLECTION_TONES.festival
    expect(collectionTone("festival", 0)).toBe(pairs[0])
    expect(collectionTone("festival", pairs.length)).toBe(pairs[0])
    expect(collectionTone("festival", 1)).toBe(pairs[1 % pairs.length])
    expect(collectionTone("festival", -3)).toBe(pairs[0])
  })
  it("uses palette colours only", () => {
    const palette = new Set<string>(Object.values(amColors))
    for (const kind of Object.keys(COLLECTION_TONES) as (keyof typeof COLLECTION_TONES)[]) {
      for (const pair of COLLECTION_TONES[kind]) for (const c of pair) expect(palette.has(c)).toBe(true)
    }
  })
})
