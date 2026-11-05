import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { STOCK_PHOTO_CREDITS } from "@/lib/photos/credits"
import { groupByCategory, hashSeed, moodForText, pickFromList, pickPool } from "@/lib/photos/pick"
import { PHOTO_MOODS, STOCK_PHOTO_META } from "@/lib/photos/photoData"
import type { PhotoMood } from "@/lib/photos/photoData"

const COOL = [17, 19, 22, 23]
const root = path.resolve(__dirname, "..")

const UNSPLASH = STOCK_PHOTO_META.filter((p) => p.source === "unsplash")
const AM = STOCK_PHOTO_META.filter((p) => p.source === "ananda-marga")
const AM_CHOSEN = [103, 104, 107, 109, 111, 112, 116, 117, 119, 120, 123, 124, 125, 126, 127, 128, 129, 132, 138, 140, 150, 164]
const AM_NOT_CHOSEN = [108, 121]
const SEEDS = Array.from({ length: 300 }, (_, i) => `seed-${i}`)

/** JPEG size from the SOF marker, no image library needed. */
function jpegSize(file: string): { width: number; height: number } {
  const b = readFileSync(file)
  let i = 2
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error(`bad jpeg ${file}`)
    const marker = b[i + 1]
    const len = b.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
    }
    i += 2 + len
  }
  throw new Error(`no SOF in ${file}`)
}

describe("stock photo data", () => {
  it("has 27 Unsplash and 22 Ananda Marga photos with unique ids and numbers", () => {
    expect(UNSPLASH).toHaveLength(27)
    expect(AM).toHaveLength(22)
    expect(STOCK_PHOTO_META).toHaveLength(49)
    expect(new Set(STOCK_PHOTO_META.map((p) => p.id)).size).toBe(49)
    expect(new Set(STOCK_PHOTO_META.map((p) => p.n)).size).toBe(49)
  })

  it("holds exactly the chosen Ananda Marga photos and not the rejected ones", () => {
    expect(AM.map((p) => p.n).sort((a, b) => a - b)).toEqual(AM_CHOSEN)
    for (const n of AM_NOT_CHOSEN) expect(STOCK_PHOTO_META.some((p) => p.n === n)).toBe(false)
    for (const p of AM) expect(p.id).toBe(`am-${p.n}-${p.slug}`)
  })

  it("marks exactly 17, 19, 22, 23 of the Unsplash photos as cool, and only 150 (blue stage) of Ananda Marga's", () => {
    expect(UNSPLASH.filter((p) => p.tone === "cool").map((p) => p.n)).toEqual(COOL)
    expect(AM.filter((p) => p.tone === "cool").map((p) => p.n)).toEqual([150])
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

  it("records the real cover size (Ananda Marga: long side within 1400 px, never upscaled), thumb within 480 px wide", () => {
    for (const p of STOCK_PHOTO_META) {
      const cover = jpegSize(path.join(root, "assets/photos/cover", `${p.id}.jpg`))
      expect(cover, p.id).toEqual({ width: p.width, height: p.height })
      expect(p.width, p.id).toBeLessThanOrEqual(1400)
      if (p.source === "ananda-marga") expect(Math.max(p.width, p.height), p.id).toBeLessThanOrEqual(1400)
      const thumb = jpegSize(path.join(root, "assets/photos/thumb", `${p.id}.jpg`))
      expect(thumb.width, p.id).toBeLessThanOrEqual(480)
      expect(thumb.width, p.id).toBeLessThanOrEqual(p.width)
    }
    for (const p of AM) {
      const thumb = jpegSize(path.join(root, "assets/photos/thumb", `${p.id}.jpg`))
      expect(thumb.width / thumb.height, p.id).toBeCloseTo(p.width / p.height, 1)
    }
  })

  it("marks lowRes exactly when the long side is under 1000 px (140 and 164)", () => {
    for (const p of STOCK_PHOTO_META) expect(Boolean(p.lowRes), p.id).toBe(Math.max(p.width, p.height) < 1000)
    expect(STOCK_PHOTO_META.filter((p) => p.lowRes).map((p) => p.n)).toEqual([140, 164])
  })

  it("tags every photo with people; every child photo is tagged children, hands and objects none", () => {
    for (const p of STOCK_PHOTO_META) expect(["none", "far", "close", "children"]).toContain(p.people)
    for (const p of STOCK_PHOTO_META.filter((q) => q.category === "children")) expect(p.people).toBe("children")
    for (const n of [107, 116, 119, 120, 127]) expect(STOCK_PHOTO_META.find((p) => p.n === n)?.people).toBe("children")
    for (const p of STOCK_PHOTO_META.filter((q) => ["hands", "sound", "light"].includes(q.category))) expect(p.people).toBe("none")
  })

  it("every mood has a photo, also among the photos picked by default", () => {
    for (const m of PHOTO_MOODS) {
      expect(STOCK_PHOTO_META.some((p) => p.moods.includes(m))).toBe(true)
      expect(pickPool(STOCK_PHOTO_META, m).length).toBeGreaterThan(0)
    }
  })

  it("credits list every photo with a credit line, link and licence", () => {
    expect(STOCK_PHOTO_CREDITS).toHaveLength(49)
    for (const c of STOCK_PHOTO_CREDITS) {
      expect(c.credit.length).toBeGreaterThan(10)
      expect(c.licenseNote.length).toBeGreaterThan(10)
      if (c.source === "unsplash") {
        expect(c.pageUrl).toMatch(/^https:\/\/unsplash\.com\/photos\//)
        expect(c.license).toBe("Unsplash License")
      } else {
        expect(c.pageUrl).toMatch(/^https:\/\/anandamarga\.org\//)
        expect(c.photographer).toBe("Ananda Marga")
        expect(c.licenseNote).toBe("Ananda Marga's own photograph, used with the organisation's permission")
        expect(c.credit).toMatch(/^Photo: Ananda Marga/)
      }
    }
  })

  it("credits the two news photos with their story title, date and link", () => {
    const c150 = STOCK_PHOTO_CREDITS.find((c) => c.n === 150)
    const c164 = STOCK_PHOTO_CREDITS.find((c) => c.n === 164)
    expect(c150?.credit).toContain("Dharma MahaSammelan 2025 at Babanagar")
    expect(c150?.credit).toContain("30 October 2025")
    expect(c150?.pageUrl).toBe("https://anandamarga.org/news/dharma-mahasammelan-2025-at-babanagar-jamalpur-inspires-devo-amindia-4594")
    expect(c164?.credit).toContain("Meditation in Nature in USA")
    expect(c164?.credit).toContain("17 October 2026")
    expect(c164?.pageUrl).toBe("https://anandamarga.org/news/meditation-in-nature-in-usa-710")
    for (const c of STOCK_PHOTO_CREDITS.filter((x) => x.source === "ananda-marga" && x.n !== 150 && x.n !== 164)) {
      expect(c.credit).toBe("Photo: Ananda Marga, anandamarga.org/gallery")
      expect(c.pageUrl).toBe("https://anandamarga.org/gallery")
    }
  })
})

describe("picking", () => {
  it("is stable: the same seed gives the same photo", () => {
    for (const seed of ["morning", "k-bnk-morning", "live-delhi-evening", ""]) {
      expect(pickFromList(STOCK_PHOTO_META, seed)?.id).toBe(pickFromList(STOCK_PHOTO_META, seed)?.id)
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
      for (const m of PHOTO_MOODS) expect(pickFromList(STOCK_PHOTO_META, `x${i}`, m)?.moods).toContain(m)
    }
  })

  it("picks cool photos only for night and long", () => {
    const seen = new Set<number>()
    for (let i = 0; i < 400; i++) {
      for (const m of PHOTO_MOODS) {
        const p = pickFromList(STOCK_PHOTO_META, `c${i}`, m)
        if (p && p.tone === "cool") {
          expect(["night", "long"]).toContain(m)
          seen.add(p.n)
        }
      }
      expect(pickFromList(STOCK_PHOTO_META, `c${i}`)?.tone).toBe("warm")
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
    const ids = new Set(Array.from({ length: 60 }, (_, i) => pickFromList(STOCK_PHOTO_META, `mix-${i}`)?.id))
    expect(ids.size).toBeGreaterThan(8)
  })

  it("groups by category", () => {
    expect(groupByCategory(STOCK_PHOTO_META, "sound").map((p) => p.n)).toEqual([28, 29, 30, 31])
    expect(groupByCategory(STOCK_PHOTO_META, "children").map((p) => p.n)).toEqual([107, 116, 119, 120, 127])
    expect(groupByCategory(STOCK_PHOTO_META, "kiirtan").map((p) => p.n)).toEqual([132])
    expect(groupByCategory(STOCK_PHOTO_META, "building")).toEqual([])
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

describe("people and resolution rules", () => {
  const moods: (PhotoMood | undefined)[] = [undefined, ...PHOTO_MOODS]

  it("never picks a children or close photo by default, for any seed and mood", () => {
    const seen = new Set<string>()
    for (const seed of SEEDS) {
      for (const m of moods) {
        const p = pickFromList(STOCK_PHOTO_META, seed, m)
        expect(p).toBeDefined()
        expect(["none", "far"]).toContain(p?.people)
        seen.add(p!.id)
      }
    }
    expect([...seen].some((id) => id.startsWith("am-"))).toBe(true)
    expect(pickPool(STOCK_PHOTO_META).every((p) => p.people === "none" || p.people === "far")).toBe(true)
  })

  it("picks children and close photos only when the caller opts in with allowPeople", () => {
    const seen = new Set<string>()
    for (const seed of SEEDS) {
      for (const m of moods) {
        const p = pickFromList(STOCK_PHOTO_META, seed, m, { allowPeople: true, size: "small" })
        if (p && (p.people === "close" || p.people === "children")) seen.add(p.people)
      }
    }
    expect([...seen].sort()).toEqual(["children", "close"])
  })

  it("still prefers none or far for calm moods (night, long, morning) when people are allowed", () => {
    for (const seed of SEEDS) {
      for (const m of ["night", "long", "morning"] as const) {
        expect(["none", "far"]).toContain(pickFromList(STOCK_PHOTO_META, seed, m, { allowPeople: true })?.people)
      }
    }
  })

  it("never picks a lowRes photo unless the size is small", () => {
    const seenSmall = new Set<number>()
    for (const seed of SEEDS) {
      for (const m of moods) {
        expect(pickFromList(STOCK_PHOTO_META, seed, m)?.lowRes).toBeFalsy()
        expect(pickFromList(STOCK_PHOTO_META, seed, m, { size: "large" })?.lowRes).toBeFalsy()
        expect(pickFromList(STOCK_PHOTO_META, seed, m, { allowPeople: true })?.lowRes).toBeFalsy()
        const s = pickFromList(STOCK_PHOTO_META, seed, m, { size: "small" })
        expect(["none", "far"]).toContain(s?.people)
        if (s?.lowRes) seenSmall.add(s.n)
      }
    }
    expect([...seenSmall]).toEqual([164])
  })

  it("returns nothing, not a forbidden photo, when only forbidden photos remain", () => {
    const risky = STOCK_PHOTO_META.filter((p) => p.people === "close" || p.people === "children")
    expect(pickFromList(risky, "a")).toBeUndefined()
    expect(pickFromList(risky, "a", "calm", { allowPeople: true })).toBeDefined()
  })
})
