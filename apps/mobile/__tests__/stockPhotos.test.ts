import { existsSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { STOCK_PHOTO_CREDITS } from "@/lib/photos/credits"
import { groupByCategory, hashSeed, moodForText, pickFromList, pickPool } from "@/lib/photos/pick"
import { PHOTO_MOODS, STOCK_PHOTO_META } from "@/lib/photos/photoData"

const COOL = [17, 19, 22, 23]
const root = path.resolve(__dirname, "..")

describe("stock photo data", () => {
  it("has the 27 chosen photos with unique ids", () => {
    expect(STOCK_PHOTO_META).toHaveLength(27)
    expect(new Set(STOCK_PHOTO_META.map((p) => p.id)).size).toBe(27)
  })

  it("marks exactly 17, 19, 22, 23 as cool", () => {
    expect(STOCK_PHOTO_META.filter((p) => p.tone === "cool").map((p) => p.n)).toEqual(COOL)
  })

  it("has a cover and a thumb on disk for every photo, and a hex tint", () => {
    for (const p of STOCK_PHOTO_META) {
      for (const kind of ["cover", "thumb"]) {
        const f = path.join(root, "assets/photos", kind, `${p.id}.jpg`)
        expect(existsSync(f), f).toBe(true)
        expect(statSync(f).size).toBeGreaterThan(5000)
      }
      expect(p.tint).toMatch(/^#[0-9A-F]{6}$/)
    }
  })

  it("every mood has a photo", () => {
    for (const m of PHOTO_MOODS) expect(STOCK_PHOTO_META.some((p) => p.moods.includes(m))).toBe(true)
  })

  it("credits list every photo with a link", () => {
    expect(STOCK_PHOTO_CREDITS).toHaveLength(27)
    for (const c of STOCK_PHOTO_CREDITS) {
      expect(c.pageUrl).toMatch(/^https:\/\/unsplash\.com\/photos\//)
      expect(c.license).toBe("Unsplash License")
    }
  })
})

describe("picking", () => {
  it("is stable: the same seed gives the same photo", () => {
    for (const seed of ["morning", "k-bnk-morning", "live-delhi-evening", ""]) {
      expect(pickFromList(STOCK_PHOTO_META, seed).id).toBe(pickFromList(STOCK_PHOTO_META, seed).id)
    }
    expect(hashSeed("evening")).toBe(hashSeed("evening"))
  })

  it("never returns undefined, for any seed and mood", () => {
    for (let i = 0; i < 300; i++) {
      expect(pickFromList(STOCK_PHOTO_META, `seed-${i}`)).toBeDefined()
      for (const m of PHOTO_MOODS) expect(pickFromList(STOCK_PHOTO_META, `s${i}`, m)).toBeDefined()
    }
  })

  it("respects the mood filter", () => {
    for (let i = 0; i < 100; i++) {
      for (const m of PHOTO_MOODS) expect(pickFromList(STOCK_PHOTO_META, `x${i}`, m).moods).toContain(m)
    }
  })

  it("picks cool photos only for night and long", () => {
    const seen = new Set<number>()
    for (let i = 0; i < 400; i++) {
      for (const m of PHOTO_MOODS) {
        const p = pickFromList(STOCK_PHOTO_META, `c${i}`, m)
        if (p.tone === "cool") {
          expect(["night", "long"]).toContain(m)
          seen.add(p.n)
        }
      }
      expect(pickFromList(STOCK_PHOTO_META, `c${i}`).tone).toBe("warm")
    }
    expect(seen.size).toBeGreaterThan(0)
  })

  it("lists warm photos first in a pool", () => {
    const pool = pickPool(STOCK_PHOTO_META, "night")
    const firstCool = pool.findIndex((p) => p.tone === "cool")
    expect(pool.slice(firstCool).every((p) => p.tone === "cool")).toBe(true)
  })

  it("falls back to the whole list when a mood has no match, and handles an empty list", () => {
    const only = [STOCK_PHOTO_META[0]]
    expect(pickFromList(only, "a", "night")).toBe(only[0])
    expect(pickPool([], "night")).toEqual([])
  })

  it("spreads seeds over several photos", () => {
    const ids = new Set(Array.from({ length: 60 }, (_, i) => pickFromList(STOCK_PHOTO_META, `mix-${i}`).id))
    expect(ids.size).toBeGreaterThan(8)
  })

  it("groups by category", () => {
    expect(groupByCategory(STOCK_PHOTO_META, "sound").map((p) => p.n)).toEqual([28, 29, 30, 31])
    expect(groupByCategory(STOCK_PHOTO_META, "space")).toEqual([])
  })

  it("derives a mood from a Kiirtan title and length", () => {
    expect(moodForText("Night kiirtan for long meditation")).toBe("night")
    expect(moodForText("Morning kiirtan on the harmonium alone")).toBe("morning")
    expect(moodForText("Dipavali kiirtan, a night of lamps")).toBe("night")
    expect(moodForText("Sunrise kiirtan for the week")).toBe("morning")
    expect(moodForText("Plain title", 70 * 60)).toBe("long")
    expect(moodForText("Plain title", 300)).toBeUndefined()
  })
})
