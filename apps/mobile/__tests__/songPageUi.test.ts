import { describe, expect, it } from "vitest"

import { projectMomentum } from "@/constants/tokens/amMotion"
import { rubberBand, sheetPosition, sheetSettle } from "@/lib/songPage/sheetPhysics"
import {
  activeSection,
  isAtBottom,
  scrollTargetFor,
  tabScrollTarget,
  underlineTransform,
  visibleSections,
  type SectionId,
} from "@/lib/songPage/sections"
import {
  buildVersions,
  chordsForVersion,
  downloadLabel,
  downloadPhase,
  formatLength,
  inferInstrument,
  versionDetail,
  versionLine,
} from "@/lib/songPage/versions"

describe("sheet physics", () => {
  it("follows the finger 1:1 from the grab point", () => {
    expect(sheetPosition(0, 120, 600)).toBe(120)
    expect(sheetPosition(80, 40, 600)).toBe(120)
    expect(sheetPosition(80, -50, 600)).toBe(30)
  })

  it("resists above the open position and never reaches the limit", () => {
    const pulled = sheetPosition(0, -300, 600)
    expect(pulled).toBeLessThan(0)
    expect(Math.abs(pulled)).toBeLessThan(300)
    expect(Math.abs(pulled)).toBeLessThan(600)
    expect(rubberBand(0, 600)).toBe(0)
    expect(rubberBand(10_000, 600)).toBeLessThan(600)
  })

  it("settles by momentum projection, not by distance", () => {
    const h = 600
    // barely moved but thrown down: closes
    expect(sheetSettle(40, 1500, h).target).toBe(h)
    // dragged far but thrown back up: stays open
    expect(sheetSettle(350, -1500, h).target).toBe(0)
    // slow release past the half: closes; before the half: opens
    expect(sheetSettle(400, 0, h).target).toBe(h)
    expect(sheetSettle(200, 0, h).target).toBe(0)
  })

  it("allows overshoot only after a throw", () => {
    expect(sheetSettle(100, 0, 600).fling).toBe(false)
    expect(sheetSettle(100, 1200, 600).fling).toBe(true)
  })

  it("uses the same projection as the design tokens", () => {
    const position = 200
    const velocity = 800
    const projected = projectMomentum(position, velocity)
    expect(sheetSettle(position, velocity, 100000).target).toBe(0)
    expect(projected).toBeCloseTo(position + (velocity / 1000) * (0.998 / 0.002))
  })
})

describe("sections and the pinned tab strip", () => {
  const order: SectionId[] = ["lyrics", "meaning", "chords"]
  const tops = { lyrics: 400, meaning: 1200, chords: 2000 }

  it("hides sections without data", () => {
    expect(
      visibleSections({ lyrics: true, words: false, meaning: true, explain: false, chords: false, watch: true }),
    ).toEqual(["lyrics", "meaning", "watch"])
  })

  it("scrolls a tapped section to 40px under the strip", () => {
    expect(scrollTargetFor(1200, 52)).toBe(1108)
    expect(scrollTargetFor(10, 52)).toBe(0)
  })

  it("the tab follows the reader and the tapped target makes its own tab active", () => {
    const base = { order, tops, stripHeight: 52, atBottom: false }
    expect(activeSection({ ...base, scrollY: 0 })).toBe("lyrics")
    expect(activeSection({ ...base, scrollY: 1000 })).toBe("lyrics")
    expect(activeSection({ ...base, scrollY: scrollTargetFor(1200, 52) })).toBe("meaning")
    expect(activeSection({ ...base, scrollY: scrollTargetFor(1200, 52) - 5 })).toBe("lyrics")
  })

  it("at the very bottom the last tab is active", () => {
    expect(activeSection({ order, tops, stripHeight: 52, scrollY: 1000, atBottom: true })).toBe("chords")
    expect(isAtBottom(1000, 800, 1800)).toBe(true)
    expect(isAtBottom(900, 800, 1800)).toBe(false)
    expect(isAtBottom(0, 800, 600)).toBe(false)
  })

  it("draws the underline across the tab", () => {
    const t = underlineTransform(100, 60)
    // a 1px bar scaled 60x about its centre covers [100, 160]
    expect(t.translateX - 0.5 * (60 - 1) + 0.5 - 0.5).toBeDefined()
    expect(t.translateX + 0.5 - t.scaleX / 2).toBeCloseTo(100)
    expect(t.translateX + 0.5 + t.scaleX / 2).toBeCloseTo(160)
  })

  it("keeps the active tab in view in the sideways strip", () => {
    expect(tabScrollTarget(10, 60, 390, 0)).toBe(0)
    expect(tabScrollTarget(500, 80, 390, 0)).toBe(500 + 80 + 16 - 390)
    expect(tabScrollTarget(200, 60, 390, 100)).toBe(100)
    expect(tabScrollTarget(40, 60, 390, 300)).toBe(24)
  })
})

describe("versions and download", () => {
  const recordings = [
    { title: "Original rendition", url: "https://a/1.mp3", provider: "official" },
    { title: "Guitar - Performer B", url: "https://a/2.mp3", provider: "community" },
  ]

  it("reads the instrument from the title", () => {
    expect(inferInstrument("Guitar - B")).toBe("guitar")
    expect(inferInstrument("harmonium solo")).toBe("harmonium")
    expect(inferInstrument("Group kiirtan")).toBe("group")
    expect(inferInstrument("Original rendition")).toBe("voice")
  })

  it("builds the list with Best only where the API says so and the length only for the loaded one", () => {
    const list = buildVersions(
      recordings.map((r, i) => ({ ...r, isLatest: i === 0 })),
      "Performer A",
      "https://a/1.mp3",
      238,
    )
    expect(list).toHaveLength(2)
    expect(list[0].tag).toBe("Best")
    expect(list[0].length).toBe(238)
    expect(list[1].length).toBeNull()
    expect(list[1].instrument).toBe("guitar")
    expect(list[1].performer).toBe("Performer B")
    expect(list[1].tag).toBe("Community")
  })

  it("writes the one-line picker and the sheet row detail", () => {
    const list = buildVersions(recordings, "Performer A", "https://a/1.mp3", 238)
    expect(versionLine(list[0])).toBe("Voice · Original rendition · 3:58")
    expect(versionLine(list[1])).toBe("Guitar · Performer B")
    expect(versionDetail(list[1])).toBe("Guitar · Community")
    expect(versionLine(null)).toBe("No recording yet")
    expect(formatLength(null)).toBe("")
    expect(formatLength(0)).toBe("")
  })

  it("a guitar version turns chords on, a harmonium version selects harmonium, voice does nothing", () => {
    expect(chordsForVersion("guitar")).toEqual({ chordsOn: true, instrument: "guitar" })
    expect(chordsForVersion("harmonium")).toEqual({ chordsOn: true, instrument: "harmonium" })
    expect(chordsForVersion("voice")).toBeNull()
  })

  it("maps the download states and labels", () => {
    expect(downloadPhase({ downloaded: false, downloading: false })).toBe("idle")
    expect(downloadPhase({ downloaded: false, downloading: true })).toBe("downloading")
    expect(downloadPhase({ downloaded: true, downloading: false })).toBe("saved")
    expect(downloadLabel("idle")).toBe("Download")
    expect(downloadLabel("downloading", 0.45)).toBe("Downloading 45%")
    expect(downloadLabel("downloading")).toBe("Downloading")
    expect(downloadLabel("saved")).toBe("Downloaded")
  })
})
