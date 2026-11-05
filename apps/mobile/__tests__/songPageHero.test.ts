import { describe, expect, it } from "vitest"

import {
  barRanges,
  coverTransform,
  pageBottomInset,
  ramp,
  stickyBarValues,
  stripHairline,
  stripTop,
  type BarMarks,
} from "@/lib/songPage/stickyBar"
import {
  creditRows,
  languageParts,
  metaLine,
  nowPlaying,
  playingVersionIndex,
  previewLines,
  psLine,
  versionOrder,
} from "@/lib/songPage/nowPlaying"

const marks: BarMarks = { barHeight: 110, coverTop: 118, coverBottom: 344, titleBottom: 440, playTop: 560, playBottom: 624 }

describe("ramp", () => {
  it("is 0 before, 1 after and linear between", () => {
    expect(ramp(0, 100, 200)).toBe(0)
    expect(ramp(150, 100, 200)).toBe(0.5)
    expect(ramp(260, 100, 200)).toBe(1)
  })
  it("steps when the range is empty", () => {
    expect(ramp(99, 100, 100)).toBe(0)
    expect(ramp(100, 100, 100)).toBe(1)
  })
})

describe("sticky bar values", () => {
  it("is invisible at the top and in the rubber band", () => {
    for (const y of [0, -40, -300]) {
      const v = stickyBarValues(y, marks)
      expect(v.bg).toBe(0)
      expect(v.title).toBe(0)
      expect(v.button).toBe(0)
    }
  })
  it("fades ground, then title, then button as the hero leaves", () => {
    const r = barRanges(marks)
    expect(r.bg[1]).toBe(344 - 110)
    expect(r.title[1]).toBe(440 - 110)
    expect(r.button[1]).toBe(624 - 110)
    const early = stickyBarValues(r.bg[1], marks)
    expect(early.bg).toBe(1)
    expect(early.title).toBe(0)
    expect(early.button).toBe(0)
    const mid = stickyBarValues(r.title[1], marks)
    expect(mid.title).toBe(1)
    expect(mid.button).toBe(0)
    const late = stickyBarValues(900, marks)
    expect(late).toEqual({ bg: 1, title: 1, titleShift: 0, button: 1, buttonShift: 0 })
  })
  it("scrubs one to one: same offset, same value, in either direction", () => {
    const down = [100, 160, 220, 300, 380, 500].map((y) => stickyBarValues(y, marks))
    const up = [500, 380, 300, 220, 160, 100].map((y) => stickyBarValues(y, marks)).reverse()
    expect(up).toEqual(down)
  })
  it("never decreases while scrolling down", () => {
    let last = stickyBarValues(0, marks)
    for (let y = 1; y <= 800; y += 7) {
      const v = stickyBarValues(y, marks)
      expect(v.bg).toBeGreaterThanOrEqual(last.bg)
      expect(v.title).toBeGreaterThanOrEqual(last.title)
      expect(v.button).toBeGreaterThanOrEqual(last.button)
      expect(v.titleShift).toBeLessThanOrEqual(last.titleShift)
      last = v
    }
  })
})

describe("pinned strip", () => {
  it("rests at its place, then pins under the bar", () => {
    expect(stripTop(700, 0, 110)).toBe(700)
    expect(stripTop(700, 300, 110)).toBe(400)
    expect(stripTop(700, 590, 110)).toBe(110)
    expect(stripTop(700, 2000, 110)).toBe(110)
  })
  it("shows its hairline only after it reached the bar", () => {
    expect(stripHairline(700, 0, 110)).toBe(0)
    expect(stripHairline(700, 590, 110)).toBe(0)
    expect(stripHairline(700, 596, 110)).toBe(0.5)
    expect(stripHairline(700, 900, 110)).toBe(1)
  })
})

describe("cover", () => {
  it("grows a little when pulled down and shrinks and fades when scrolled", () => {
    expect(coverTransform(-90, 226).scale).toBeCloseTo(1.1, 5)
    expect(coverTransform(-5000, 226).scale).toBeCloseTo(1.2, 5)
    expect(coverTransform(0, 226)).toEqual({ scale: 1, opacity: 1, lift: 0 })
    const gone = coverTransform(226, 226)
    expect(gone.scale).toBeCloseTo(0.8, 5)
    expect(gone.opacity).toBeCloseTo(0.15, 5)
  })
})

describe("bottom inset", () => {
  it("clears the mini-player pill only when it is on screen", () => {
    expect(pageBottomInset({ safeBottom: 34, miniVisible: true })).toBe(34 + 64 + 12 + 24)
    expect(pageBottomInset({ safeBottom: 0, miniVisible: true })).toBe(12 + 64 + 12 + 24)
    expect(pageBottomInset({ safeBottom: 34, miniVisible: false })).toBe(34 + 24)
  })
})

describe("is this song playing", () => {
  const song = { id: "ps-3", number: 3 }
  const versions = [{ url: "https://a/1.mp3" }, { url: "https://a/2.mp3" }, { url: "https://a/3.mp3" }]
  it("is not current when another song plays", () => {
    const state = { currentSong: { id: "ps-9", number: 9 } as never, isPlaying: true, isBuffering: false }
    expect(nowPlaying(state, song, versions)).toEqual({ isCurrent: false, showPause: false, buffering: false, versionIndex: -1 })
  })
  it("is current and paused", () => {
    const state = { currentSong: { id: "ps-3", number: 3, audioUrl: "https://a/2.mp3" } as never, isPlaying: false, isBuffering: false }
    expect(nowPlaying(state, song, versions)).toMatchObject({ isCurrent: true, showPause: false, versionIndex: 1 })
  })
  it("shows pause while playing, also while buffering", () => {
    const state = { currentSong: { id: "x", number: 3, audioUrl: "https://a/3.mp3" } as never, isPlaying: true, isBuffering: true }
    expect(nowPlaying(state, song, versions)).toEqual({ isCurrent: true, showPause: true, buffering: true, versionIndex: 2 })
  })
  it("nothing loaded is not current", () => {
    expect(nowPlaying({ currentSong: null, isPlaying: false, isBuffering: false }, song, versions).isCurrent).toBe(false)
  })
})

describe("playing version", () => {
  const versions = [{ url: "u0" }, { url: "u1" }, { url: "u2" }]
  it("reads the demo player's version from its url", () => {
    expect(playingVersionIndex(versions, "demo://ps-3/v3")).toBe(2)
    expect(playingVersionIndex(versions, "demo://ps-3/v9")).toBe(0)
  })
  it("matches by url and falls back to the first for a local copy", () => {
    expect(playingVersionIndex(versions, "u1")).toBe(1)
    expect(playingVersionIndex(versions, "file:///offline/x.mp3")).toBe(0)
    expect(playingVersionIndex(versions, null)).toBe(0)
  })
  it("is -1 without versions", () => {
    expect(playingVersionIndex([], "u1")).toBe(-1)
  })
})

describe("versions order", () => {
  it("lists Best, Verified, untagged, Community, Instrumental, stable inside a group", () => {
    const tags = ["Community", "Verified", null, "Best", "Instrumental", "Verified"] as const
    expect(versionOrder(tags.map((tag) => ({ tag })))).toEqual([3, 1, 5, 2, 0, 4])
  })
  it("keeps the catalog order when nothing is tagged", () => {
    expect(versionOrder([{ tag: null }, { tag: null }, { tag: null }])).toEqual([0, 1, 2])
  })
  it("handles an empty list", () => {
    expect(versionOrder([])).toEqual([])
  })
})

describe("hero text", () => {
  it("writes the collection line", () => {
    expect(psLine(1)).toBe("PS 1 · Prabhat Samgiita")
  })
  it("writes the meta line and drops what is unknown", () => {
    expect(metaLine({ seconds: 222, versionCount: 6, languages: ["Hindi", "Bengali"] })).toBe("3:42 · 6 versions · Hindi/Bengali")
    expect(metaLine({ seconds: null, versionCount: 1, languages: [] })).toBe("1 version")
    expect(metaLine({ seconds: 0, versionCount: 0, languages: ["Roman"] })).toBe("Roman")
  })
  it("names languages, or the scripts when the catalog only gives a script", () => {
    expect(languageParts("Hindi/Bengali", ["roman"])).toEqual(["Hindi", "Bengali"])
    expect(languageParts("Bengali", [])).toEqual(["Bengali"])
    expect(languageParts("Roman", ["roman", "devanagari"])).toEqual(["Roman", "Devanagari"])
    expect(languageParts(null, ["roman"])).toEqual(["Roman"])
  })
  it("lists the author once, then a performer only when one is given", () => {
    expect(creditRows("Performer A")).toEqual([
      { role: "Words and music", name: "Shrii P. R. Sarkar (Prabhat Samgiita)" },
      { role: "Performer", name: "Performer A" },
    ])
    expect(creditRows("  ")).toHaveLength(1)
  })
  it("takes the first four lines that have text", () => {
    expect(previewLines(["a", " ", "b", "c", "d", "e"])).toEqual(["a", "b", "c", "d"])
  })
})
