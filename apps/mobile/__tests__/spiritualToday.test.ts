import { describe, expect, it } from "vitest"

import { sampleSpiritualSongs } from "@/lib/fixtures/todaySpiritual"
import type { Kirtan } from "@/lib/kirtan/types"
import { spiritualForToday, spiritualNewlyAdded, spiritualSongs } from "@/lib/spiritualToday"

const rec = (id: string, kind: Kirtan["kind"], addedAt: number, status: Kirtan["status"] = "published"): Kirtan => ({
  id,
  kind,
  title: id,
  author: "A",
  durationSec: 100,
  type: "other",
  audioUrl: null,
  thumbnailUrl: null,
  addedBy: "A",
  status,
  addedAt,
})

describe("spiritual songs on Today", () => {
  const list = [
    rec("k1", "kiirtan", 9),
    rec("s1", "spiritual_song", 1),
    rec("s2", "spiritual_song", 5),
    rec("s3", "spiritual_song", 3),
    rec("s4", "spiritual_song", 7),
    rec("s5", "spiritual_song", 2),
    rec("gone", "spiritual_song", 8, "removed"),
    rec("up", "spiritual_song", 8, "uploading"),
    rec("b1", "bhajan", 6),
  ]

  it("keeps only published spiritual songs, newest first", () => {
    expect(spiritualSongs(list).map((k) => k.id)).toEqual(["s4", "s2", "s3", "s5", "s1"])
  })

  it("is empty, so no shelf shows, when there are none", () => {
    expect(spiritualForToday([rec("k1", "kiirtan", 1)], 5)).toEqual([])
    expect(spiritualNewlyAdded([], [])).toEqual([])
  })

  it("gives the same handful all day and a different one the next day", () => {
    const a = spiritualForToday(list, 20000).map((k) => k.id)
    expect(spiritualForToday(list, 20000).map((k) => k.id)).toEqual(a)
    expect(a).toHaveLength(3)
    expect(spiritualForToday(list, 20001).map((k) => k.id)).not.toEqual(a)
    expect(new Set(a).size).toBe(3)
  })

  it("never fails on a short list or a negative day", () => {
    expect(spiritualForToday([rec("s1", "spiritual_song", 1)], -3)).toHaveLength(1)
    expect(spiritualForToday(list.slice(0, 3), 7)).toHaveLength(2)
  })

  it("lists the newly added without repeating the day's handful, and hides itself when too few are left", () => {
    const today = spiritualForToday(list, 20000)
    const fresh = spiritualNewlyAdded(list, today)
    expect(fresh.map((k) => k.id).some((id) => today.some((t) => t.id === id))).toBe(false)
    expect(fresh).toHaveLength(2)
    expect(spiritualNewlyAdded(list.slice(0, 5), spiritualForToday(list.slice(0, 5), 1))).toEqual([])
  })

  it("the sample songs exist only in the preview", () => {
    expect(sampleSpiritualSongs(false)).toEqual([])
    const demo = sampleSpiritualSongs(true)
    expect(demo.length).toBeGreaterThanOrEqual(5)
    expect(spiritualSongs(demo)).toHaveLength(demo.length)
  })
})
