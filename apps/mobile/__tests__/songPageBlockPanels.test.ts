import { describe, expect, it } from "vitest"

import {
  DOT_STEP,
  MIN_VIEW,
  PANELS_HEAD,
  PANEL_COUNT,
  buildFrame,
  dotMarkX,
  jumpScroll,
  landingPanel,
  panelAt,
  panelIndexOf,
  panelPosAt,
  panelReadEnd,
  panelStart,
  panelTab,
  pinDistance,
  readOffsetAt,
  readingScroll,
  rowOffset,
  settleScroll,
  stageShift,
  stripPanelOn,
  type PanelsLayout,
} from "@/lib/songPage/blockPanels"
import { stripVisible } from "@/lib/songPage/readingStrip"

const W = 390
/** a short song: every panel fits in the stage */
const short: PanelsLayout = { width: W, overflows: [0, 0, 0] }
/** a long song: lyrics run 300 under the stage, commentary fits, the word grid runs 1000 under */
const long: PanelsLayout = { width: W, overflows: [300, 0, 1000] }

describe("block panels: the sizes", () => {
  it("a short song's stage is as tall as its tallest panel, never below the minimum, and the pin is two slides", () => {
    const f = buildFrame({ width: W, contents: [420, 380, 300], available: 700 })
    expect(f.view).toBe(420)
    expect(f.stage).toBe(420 + PANELS_HEAD)
    expect(f.layout.overflows).toEqual([0, 0, 0])
    expect(f.distance).toBe(2 * W)
    expect(buildFrame({ width: W, contents: [10, 0, 0], available: 700 }).view).toBe(MIN_VIEW)
  })

  it("a tall panel is capped to what the screen leaves, and its overflow lengthens the pin", () => {
    const f = buildFrame({ width: W, contents: [900, 500, 2000], available: 600 })
    expect(f.view).toBe(600 - PANELS_HEAD)
    expect(f.layout.overflows).toEqual([900 - f.view, 0, 2000 - f.view])
    expect(f.distance).toBe(f.layout.overflows[0]! + f.layout.overflows[2]! + 2 * W)
  })

  it("a screen too small for the minimum window still gets the minimum", () => {
    expect(buildFrame({ width: W, contents: [900, 900, 900], available: 100 }).view).toBe(MIN_VIEW)
  })
})

describe("block panels: the timeline", () => {
  it("starts and read ends: each panel is read, then one stage width of slide", () => {
    expect(panelStart(long, 0)).toBe(0)
    expect(panelReadEnd(long, 0)).toBe(300)
    expect(panelStart(long, 1)).toBe(300 + W)
    expect(panelReadEnd(long, 1)).toBe(300 + W)
    expect(panelStart(long, 2)).toBe(300 + 2 * W)
    expect(panelReadEnd(long, 2)).toBe(300 + 2 * W + 1000)
    expect(pinDistance(long)).toBe(1300 + 2 * W)
    expect(pinDistance(short)).toBe(2 * W)
  })

  it("the row's position is one to one with the scroll during a slide and still while a panel is read", () => {
    expect(panelPosAt(long, 0)).toBe(0)
    expect(panelPosAt(long, 299)).toBe(0)
    expect(panelPosAt(long, 300)).toBe(0)
    expect(panelPosAt(long, 300 + W / 2)).toBeCloseTo(0.5, 10)
    expect(panelPosAt(long, 300 + W)).toBe(1)
    // commentary fits (no read), so its slide to the word grid starts the moment it has arrived
    expect(panelPosAt(long, 300 + W + 0.25 * W)).toBeCloseTo(1.25, 10)
    // a panel with a read holds still while it is read
    const tall: PanelsLayout = { width: W, overflows: [0, 200, 0] }
    expect(panelPosAt(tall, W)).toBe(1)
    expect(panelPosAt(tall, W + 150)).toBe(1)
    expect(panelPosAt(tall, W + 200 + W / 2)).toBeCloseTo(1.5, 10)
    expect(panelPosAt(long, panelStart(long, 2))).toBe(2)
    expect(panelPosAt(long, pinDistance(long))).toBe(2)
  })

  it("is clamped outside the pin: nothing moves before it, nothing after it", () => {
    expect(panelPosAt(long, -500)).toBe(0)
    expect(panelPosAt(long, pinDistance(long) + 900)).toBe(2)
    expect(panelPosAt(short, 1.5 * W)).toBeCloseTo(1.5, 10)
  })

  it("a lone panel or no width has nowhere to slide", () => {
    expect(panelPosAt({ width: W, overflows: [100] }, 80)).toBe(0)
    expect(panelPosAt({ width: 0, overflows: [0, 0, 0] }, 80)).toBe(0)
    expect(pinDistance({ width: W, overflows: [] })).toBe(0)
  })

  it("each panel's text moves up only while that panel is the one being read", () => {
    expect(readOffsetAt(long, -20, 0)).toBe(0)
    expect(readOffsetAt(long, 120, 0)).toBe(120)
    expect(readOffsetAt(long, 300, 0)).toBe(300)
    // after its read it stays at its bottom while it slides away
    expect(readOffsetAt(long, 600, 0)).toBe(300)
    // the next panel waits at its top until it has arrived
    expect(readOffsetAt(long, 600, 2)).toBe(0)
    expect(readOffsetAt(long, panelStart(long, 2) + 400, 2)).toBe(400)
    expect(readOffsetAt(long, panelStart(long, 2) + 5000, 2)).toBe(1000)
    // a panel that fits never moves
    expect(readOffsetAt(long, 9999, 1)).toBe(0)
  })
})

describe("block panels: the pinned stage", () => {
  const pin = 800
  const d = pinDistance(long)
  it("sits still before the pin, is held by exactly the scroll during it, and is left behind after it", () => {
    expect(stageShift(0, pin, d)).toBe(0)
    expect(stageShift(799, pin, d)).toBe(0)
    expect(stageShift(900, pin, d)).toBe(100)
    expect(stageShift(pin + d, pin, d)).toBe(d)
    expect(stageShift(pin + d + 500, pin, d)).toBe(d)
  })

  it("the reading strip sees the lyrics where they really are: page scroll less the stage's push plus the text's own move", () => {
    // before the pin the lyrics ride with the page
    expect(readingScroll(long, 500, pin)).toBe(500)
    // while pinned the stage is held, so the lyrics' place depends only on how far their text moved
    expect(readingScroll(long, pin, pin)).toBe(pin)
    expect(readingScroll(long, pin + 120, pin)).toBe(pin + 120)
    // lyrics read to the end, then the panels slide: the lyrics no longer move
    expect(readingScroll(long, pin + 500, pin)).toBe(pin + 300)
    // after the pin the page carries the stage away: lyrics are as far up as the page went, less what the stage did not follow
    expect(readingScroll(long, pin + d + 100, pin)).toBe(pin + d + 100 - d + 300)
  })
})

describe("block panels: the swipe", () => {
  it("the row follows the finger one to one from the grab point", () => {
    const base = { width: W, count: PANEL_COUNT, rubber: true }
    expect(rowOffset({ ...base, pos: 0, drag: -120 })).toBe(-120)
    expect(rowOffset({ ...base, pos: 1, drag: 40 })).toBe(-W + 40)
    expect(rowOffset({ ...base, pos: 0.5, drag: -10 })).toBeCloseTo(-W / 2 - 10, 10)
  })

  it("meets a rubber band past the first and the last panel, never a hard stop and never 1:1", () => {
    const base = { width: W, count: PANEL_COUNT, rubber: true }
    const past = rowOffset({ ...base, pos: 0, drag: 200 })
    expect(past).toBeGreaterThan(0)
    expect(past).toBeLessThan(200)
    expect(rowOffset({ ...base, pos: 0, drag: 400 })).toBeGreaterThan(past)
    expect(rowOffset({ ...base, pos: 0, drag: 400 })).toBeLessThan(W)
    const last = rowOffset({ ...base, pos: 2, drag: -200 })
    expect(last).toBeLessThan(-2 * W)
    expect(last).toBeGreaterThan(-2 * W - 200)
    // a settling spring draws plain positions, rubber off
    expect(rowOffset({ ...base, rubber: false, pos: 0, drag: 200 })).toBe(200)
  })

  it("a slow short drag stays; past half a panel it turns", () => {
    expect(landingPanel({ from: 0, x: -60, velocity: 0, width: W, count: 3 })).toEqual({ index: 0, fling: false })
    expect(landingPanel({ from: 0, x: -190, velocity: 0, width: W, count: 3 }).index).toBe(0)
    expect(landingPanel({ from: 0, x: -200, velocity: 0, width: W, count: 3 }).index).toBe(1)
    expect(landingPanel({ from: 1, x: -W + 250, velocity: 0, width: W, count: 3 }).index).toBe(0)
  })

  it("the landing is the projection of the throw: current + (v/1000) * 0.998 / (1 - 0.998)", () => {
    // 100 px/s projects 49.9 px further
    expect(landingPanel({ from: 0, x: -170, velocity: -100, width: W, count: 3 }).index).toBe(1)
    expect(landingPanel({ from: 0, x: -170, velocity: 100, width: W, count: 3 }).index).toBe(0)
    // a short, fast flick turns the page although the finger went 50 px
    expect(landingPanel({ from: 0, x: -50, velocity: -900, width: W, count: 3 }).index).toBe(1)
    expect(landingPanel({ from: 1, x: -W + 50, velocity: 900, width: W, count: 3 }).index).toBe(0)
  })

  it("a hard flick is one page, not three, and the ends hold", () => {
    expect(landingPanel({ from: 0, x: -100, velocity: -6000, width: W, count: 3 }).index).toBe(1)
    expect(landingPanel({ from: 1, x: -W - 100, velocity: -6000, width: W, count: 3 }).index).toBe(2)
    expect(landingPanel({ from: 2, x: -2 * W - 100, velocity: -6000, width: W, count: 3 }).index).toBe(2)
    expect(landingPanel({ from: 0, x: 100, velocity: 6000, width: W, count: 3 }).index).toBe(0)
  })

  it("only a throw may overshoot; a plain release settles without", () => {
    expect(landingPanel({ from: 0, x: -250, velocity: 0, width: W, count: 3 }).fling).toBe(false)
    expect(landingPanel({ from: 0, x: -250, velocity: -500, width: W, count: 3 }).fling).toBe(false)
    expect(landingPanel({ from: 0, x: -250, velocity: -700, width: W, count: 3 }).fling).toBe(true)
    expect(landingPanel({ from: 1, x: -W, velocity: 2000, width: W, count: 3 }).fling).toBe(true)
  })
})

describe("block panels: where a swipe leaves the scroll", () => {
  it("a swipe that comes back to the panel it started on leaves the scroll alone", () => {
    expect(settleScroll(long, 120, 0)).toBe(120)
    expect(settleScroll(long, panelStart(long, 2) + 400, 2)).toBe(panelStart(long, 2) + 400)
    expect(settleScroll(long, -35, 0)).toBe(-35)
  })

  it("a panel entered by a swipe is entered at its top, forwards or backwards", () => {
    expect(settleScroll(long, 120, 1)).toBe(panelStart(long, 1))
    expect(settleScroll(long, 120, 2)).toBe(panelStart(long, 2))
    expect(settleScroll(long, panelStart(long, 2) + 400, 0)).toBe(0)
    expect(settleScroll(long, panelStart(long, 2) + 400, 1)).toBe(panelStart(long, 1))
  })

  it("half way through a slide, the swipe finishes the slide it is in or goes back", () => {
    const mid = panelReadEnd(long, 0) + W * 0.3
    expect(settleScroll(long, mid, 0)).toBe(panelReadEnd(long, 0))
    expect(settleScroll(long, mid, 1)).toBe(panelStart(long, 1))
    const later = panelReadEnd(long, 0) + W * 0.8
    expect(settleScroll(long, later, 1)).toBe(panelStart(long, 1))
    expect(settleScroll(long, later, 0)).toBe(panelReadEnd(long, 0))
  })

  it("in a short song the panels sit at the ends of the two slides", () => {
    expect(settleScroll(short, 100, 1)).toBe(W)
    expect(settleScroll(short, 100, 2)).toBe(2 * W)
    expect(panelStart(short, 1)).toBe(W)
  })

  it("a jump to a panel leaves it at rest at the top of the pinned stage; Lyrics leaves the block a little under the strip", () => {
    expect(jumpScroll(long, 800, 1)).toBe(800 + panelStart(long, 1))
    expect(jumpScroll(long, 800, 2)).toBe(800 + panelStart(long, 2))
    expect(jumpScroll(long, 800, 0)).toBe(800 - 24)
    expect(jumpScroll(long, 10, 0)).toBe(0)
  })
})

describe("block panels: which panel, which label, which dot", () => {
  it("the nearest panel at rest", () => {
    expect(panelAt(0)).toBe(0)
    expect(panelAt(0.49)).toBe(0)
    expect(panelAt(0.5)).toBe(1)
    expect(panelAt(1.4)).toBe(1)
    expect(panelAt(1.6)).toBe(2)
    expect(panelAt(-0.3)).toBe(0)
    expect(panelAt(4)).toBe(2)
  })

  it("panel order is Lyrics, Commentary, Word by word", () => {
    expect([0, 1, 2].map(panelTab)).toEqual(["lyrics", "commentary", "words"])
    expect(panelTab(7)).toBe("words")
    expect(panelTab(-2)).toBe("lyrics")
    expect((["lyrics", "commentary", "words"] as const).map(panelIndexOf)).toEqual([0, 1, 2])
  })

  it("the compact reading strip belongs to the Lyrics panel only: there while it is the nearest panel, gone once the row is past half way", () => {
    const on = { split: "stanzas", translationOn: true, inView: true, sheetOpen: false } as const
    const shown = (pos: number) => stripVisible({ ...on, tab: panelTab(panelAt(pos)) })
    expect(stripPanelOn(0)).toBe(true)
    expect(stripPanelOn(0.45)).toBe(true)
    expect(stripPanelOn(0.55)).toBe(false)
    expect(shown(0)).toBe(true)
    expect(shown(0.3)).toBe(true)
    expect(shown(0.7)).toBe(false)
    expect(shown(1)).toBe(false)
    expect(shown(2)).toBe(false)
    // and it still needs the lyrics on screen
    expect(stripVisible({ ...on, tab: "lyrics", inView: false })).toBe(false)
  })

  it("the dots' mark travels one step per panel and stays between the first and the last dot", () => {
    expect(dotMarkX(0)).toBe(0)
    expect(dotMarkX(1)).toBe(DOT_STEP)
    expect(dotMarkX(0.5)).toBe(DOT_STEP / 2)
    expect(dotMarkX(-1)).toBe(0)
    expect(dotMarkX(5)).toBe(2 * DOT_STEP)
  })
})
