import { describe, expect, it } from "vitest"

import { DEFAULT_KIIRTAN_TAB, isKiirtanTab, KIIRTAN_TABS, openingTab } from "@/lib/recordingExtras/kiirtanTabs"
import { compactRanges, scrollOffsetFor, TUNE_ROW, TUNE_ROWS_SHOWN } from "@/lib/recordingChords/tuneList"
import { chordFont, discSize, RING_TAG_ROOM, ringPoints, ringSizeFor } from "@/lib/recordingChords/ringGeometry"

describe("Kiirtan page tabs", () => {
  it("are in Dada's order: Chords, Video, Notes, Story", () => {
    expect(KIIRTAN_TABS).toEqual(["chords", "video", "notes", "story"])
    expect(DEFAULT_KIIRTAN_TAB).toBe("chords")
  })
  it("opens on Chords unless a link or a reply says otherwise", () => {
    expect(openingTab({})).toBe("chords")
    expect(openingTab({ tab: "video" })).toBe("video")
    expect(openingTab({ tab: "nonsense" })).toBe("chords")
    expect(openingTab({ tab: "video", focus: true })).toBe("story")
    expect(isKiirtanTab("notes")).toBe(true)
    expect(isKiirtanTab(3)).toBe(false)
  })
})

describe("compactRanges", () => {
  it("writes runs of three or more as a range", () => {
    expect(compactRanges([1, 2, 3, 7, 9, 10])).toBe("1–3, 7, 9, 10")
    expect(compactRanges([1, 2, 3, 7, 8, 12])).toBe("1–3, 7, 8, 12")
    expect(compactRanges([5, 4, 3, 3])).toBe("3–5")
    expect(compactRanges([])).toBe("")
    expect(compactRanges([2])).toBe("2")
    expect(compactRanges(Array.from({ length: 30 }, (_, i) => i + 1))).toBe("1–30")
  })
})

describe("scrollOffsetFor", () => {
  it("puts the chosen number in the middle, and never scrolls past the ends", () => {
    expect(scrollOffsetFor(1, 30)).toBe(0)
    expect(scrollOffsetFor(2, 30)).toBe(0)
    expect(scrollOffsetFor(12, 30)).toBe((12 - 1 - Math.floor(TUNE_ROWS_SHOWN / 2)) * TUNE_ROW)
    expect(scrollOffsetFor(30, 30)).toBe((30 - TUNE_ROWS_SHOWN) * TUNE_ROW)
    expect(scrollOffsetFor(3, 4)).toBe(0)
  })
})

describe("chord ring geometry", () => {
  it("fills a 390 px phone without overflowing it", () => {
    const size = ringSizeFor(390, 20)
    expect(size + RING_TAG_ROOM).toBeLessThanOrEqual(390 - 2 * 20)
    expect(size).toBeGreaterThanOrEqual(300)
  })
  it("stays a circle on a tablet", () => {
    expect(ringSizeFor(1024, 20)).toBe(340)
  })
  it("never lets two neighbouring discs touch, 4 to 8 chords, 360 and 390 px", () => {
    for (const width of [360, 390]) {
      const size = ringSizeFor(width, 20)
      for (let n = 4; n <= 8; n += 1) {
        const disc = discSize(n)
        const pts = ringPoints(n, (size - disc) / 2, 0, 0)
        for (let i = 0; i < n; i += 1) {
          const a = pts[i]!
          const b = pts[(i + 1) % n]!
          const gap = Math.hypot(a.x - b.x, a.y - b.y) - disc
          expect(gap, `${n} chords at ${width}px`).toBeGreaterThanOrEqual(12)
        }
      }
    }
  })
  it("keeps every disc a touch target", () => {
    for (let n = 1; n <= 8; n += 1) expect(discSize(n)).toBeGreaterThanOrEqual(44)
  })
  it("shrinks the font for long names so they fit whole", () => {
    expect(chordFont("C")).toBeGreaterThan(chordFont("Asus4"))
    expect(chordFont("Asus4")).toBeGreaterThan(chordFont("C#maj7"))
  })
  it("puts the first place at the top, going clockwise", () => {
    const [first, second] = ringPoints(4, 100, 0, 0)
    expect(first!.x).toBeCloseTo(0)
    expect(first!.y).toBeCloseTo(-100)
    expect(second!.x).toBeCloseTo(100)
  })
})

describe("player chip", () => {
  it("is wired into the player for a Kiirtan with a page, and opens the recording page", async () => {
    const { readFileSync } = await import("node:fs")
    const src = readFileSync("app/player-v2.tsx", "utf8")
    expect(src).toContain("<RecordingPageChip")
    expect(src).toMatch(/isK && extrasRecording && !drive/)
    expect(src.match(/\{pageChip\}/g)?.length).toBe(2)
    expect(readFileSync("components/player-v2/RecordingPageChip.tsx", "utf8")).toContain("kPage.chip.label")
  })
})
