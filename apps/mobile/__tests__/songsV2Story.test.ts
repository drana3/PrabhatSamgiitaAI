import { describe, expect, it, vi } from "vitest"

import { amSpring, projectMomentum } from "@/constants/tokens/amMotion"
import { createStoryLoader, type StoryDetailLike } from "@/lib/songsV2/storyLoader"
import { buildStorySheet, shapeParagraphs, songHrefFor, STORY_MAX_PARAGRAPHS } from "@/lib/songsV2/storySheet"
import { project, resolveRelease, rubberBand, scrimOpacity, sheetOffsetForDrag, springVelocity } from "@/lib/songsV2/sheetPhysics"

describe("story shaping", () => {
  it("keeps up to six paragraphs as they are", () => {
    const body = ["a", "b", "c", "d", "e", "f"]
    expect(shapeParagraphs(body)).toEqual(body)
  })
  it("joins the shortest neighbours until six remain, losing no words", () => {
    const body = ["aaaa aaaa aaaa", "b", "c", "dddd dddd dddd", "eeee eeee eeee", "ffff ffff", "gggg gggg gggg", "h"]
    const out = shapeParagraphs(body)
    expect(out.length).toBeLessThanOrEqual(STORY_MAX_PARAGRAPHS)
    expect(out.join(" ")).toBe(body.join(" "))
  })
  it("drops empty paragraphs and collapses whitespace", () => {
    expect(shapeParagraphs(["  one   two ", "", "  "])).toEqual(["one two"])
  })
  it("uses the teaser when there is no body", () => {
    expect(shapeParagraphs([], "A teaser.")).toEqual(["A teaser."])
    expect(shapeParagraphs([], "")).toEqual([])
  })
})

describe("story sheet content", () => {
  it("opens the first related song", () => {
    const c = buildStorySheet({ slug: "s", title: "T", body: ["one two three"], songNumbers: [0, 7, 9], sourceUrl: " https://x " })
    expect(c.songNumber).toBe(7)
    expect(c.songHref).toBe("/song-v2/ps-7")
    expect(c.eyebrow).toBe("Story · 1 min read")
    expect(c.sourceUrl).toBe("https://x")
  })
  it("has no button target without a song", () => {
    const c = buildStorySheet({ slug: "s", title: "T", teaser: "x", songNumbers: [] })
    expect(c.songNumber).toBeNull()
    expect(c.songHref).toBeNull()
    expect(songHrefFor(0)).toBeNull()
  })
})

describe("story loader", () => {
  const detail = (slug: string): StoryDetailLike => ({
    slug,
    title: slug,
    teaser: "",
    song_numbers: [1],
    body_paragraphs: ["word ".repeat(450)],
  })
  it("loads once, caches and reports read time", async () => {
    const fetchStory = vi.fn(async (slug: string) => detail(slug))
    const loader = createStoryLoader(fetchStory)
    expect(loader.peekMinutes("a")).toBeNull()
    const [x, y] = await Promise.all([loader.load("a"), loader.load("a")])
    expect(x).toBe(y)
    await loader.load("a")
    expect(fetchStory).toHaveBeenCalledTimes(1)
    expect(loader.peekMinutes("a")).toBe(3)
  })
  it("does not cache a failure", async () => {
    let calls = 0
    const loader = createStoryLoader(async (slug) => (++calls === 1 ? null : detail(slug)))
    expect(await loader.load("a")).toBeNull()
    expect(await loader.load("a")).not.toBeNull()
  })
  it("survives a thrown fetch", async () => {
    const loader = createStoryLoader(async () => {
      throw new Error("offline")
    })
    expect(await loader.load("a")).toBeNull()
  })
  it("prefetches only the first few", async () => {
    const fetchStory = vi.fn(async (slug: string) => detail(slug))
    const loader = createStoryLoader(fetchStory)
    await loader.prefetch(["1", "2", "3", "4"], 3, 2)
    expect(fetchStory).toHaveBeenCalledTimes(3)
    expect(loader.peek("4")).toBeNull()
  })
})

describe("sheet physics", () => {
  it("projects momentum like the shared token", () => {
    for (const [x, v] of [[0, 0], [40, 1500], [300, -900]]) expect(project(x, v)).toBe(projectMomentum(x, v))
  })
  it("follows the finger 1:1 downward from where it was grabbed", () => {
    expect(sheetOffsetForDrag(0, 80)).toBe(80)
    expect(sheetOffsetForDrag(200, -50)).toBe(150) // caught mid-spring, no jump
  })
  it("rubber-bands past the open edge, with growing resistance", () => {
    const a = sheetOffsetForDrag(0, -40)
    const b = sheetOffsetForDrag(0, -400)
    expect(a).toBeLessThan(0)
    expect(-a).toBeLessThan(40)
    expect(-b).toBeLessThan(120)
    expect(-b).toBeGreaterThan(-a)
    expect(rubberBand(0)).toBe(0)
    expect(rubberBand(-5)).toBe(0)
  })
  it("closes on a short fast flick down", () => {
    const r = resolveRelease({ offset: 40, velocity: 1500, height: 500 })
    expect(r.closes).toBe(true)
    expect(r.target).toBe(500)
    expect(r.projected).toBe(projectMomentum(40, 1500))
  })
  it("springs back after a slow short drag", () => {
    const r = resolveRelease({ offset: 100, velocity: 0, height: 500 })
    expect(r.closes).toBe(false)
    expect(r.target).toBe(0)
  })
  it("closes after a slow drag past the middle", () => {
    expect(resolveRelease({ offset: 300, velocity: 0, height: 500 }).closes).toBe(true)
  })
  it("reopens after a fast flick up even from low", () => {
    expect(resolveRelease({ offset: 300, velocity: -1500, height: 500 }).closes).toBe(false)
  })
  it("hands velocity to the spring only while it still has travel", () => {
    expect(springVelocity(900, 100, 500)).toBe(900)
    expect(springVelocity(900, 500, 500)).toBe(0)
  })
  it("fades the scrim with the sheet", () => {
    expect(scrimOpacity(0, 500)).toBeCloseTo(0.4)
    expect(scrimOpacity(250, 500)).toBeCloseTo(0.2)
    expect(scrimOpacity(500, 500)).toBe(0)
    expect(scrimOpacity(10, 0)).toBe(0)
  })
  it("uses the no-overshoot spring by default", () => {
    expect(amSpring.default.damping).toBeGreaterThan(amSpring.fling.damping)
  })
})
