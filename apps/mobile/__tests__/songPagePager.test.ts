import { describe, expect, it } from "vitest"

import { AXIS_SLOP, MIN_VIEW, dotMarkX, decideAxis, heightAt, landingPage, pageAt, rowOffset, DOT_STEP } from "@/lib/songPage/pager"

/**
 * The scroll bug of the text block was two things: the page's vertical scroll drove the sideways slide of the pages (a
 * "pinned stage"), and the web gesture view said `touch-action: none`. The fix is a pager that only ever answers to a
 * clear sideways drag. This is the rule that says which finger belongs to whom.
 */
describe("which way a finger is going", () => {
  it("waits until the finger has moved far enough to tell", () => {
    expect(decideAxis(0, 0)).toBe("none")
    expect(decideAxis(AXIS_SLOP - 1, 0)).toBe("none")
    expect(decideAxis(0, AXIS_SLOP - 1)).toBe("none")
    expect(decideAxis(5, -6)).toBe("none")
  })

  it("a drag up or down is the page's: it scrolls", () => {
    expect(decideAxis(0, 8)).toBe("y")
    expect(decideAxis(0, -30)).toBe("y")
    expect(decideAxis(3, 40)).toBe("y")
    expect(decideAxis(-2, -12)).toBe("y")
  })

  it("a clear drag to the side turns the pages, to the left or to the right", () => {
    expect(decideAxis(12, 0)).toBe("x")
    expect(decideAxis(-40, 5)).toBe("x")
    expect(decideAxis(30, -10)).toBe("x")
  })

  it("up and down wins every doubt: a diagonal, a wobble, a tie", () => {
    expect(decideAxis(20, 20)).toBe("y")
    expect(decideAxis(20, 14)).toBe("y")
    expect(decideAxis(-12, 9)).toBe("y")
    expect(decideAxis(10, 9)).toBe("y")
  })

  it("a sideways move that is still short is not yet a swipe", () => {
    expect(decideAxis(9, 1)).toBe("none")
  })

  it("is symmetric in sign, so left and right behave the same", () => {
    for (const [dx, dy] of [[12, 3], [25, 25], [4, 20], [30, 2], [9, 7]] as const) {
      expect(decideAxis(-dx, dy)).toBe(decideAxis(dx, dy))
      expect(decideAxis(dx, -dy)).toBe(decideAxis(dx, dy))
    }
  })

  it("a finger that begins vertical never turns into a swipe, however far it drifts afterwards", () => {
    // the first sample that tells decides; the pager then ignores the rest (see usePager: axis is decided once)
    expect(decideAxis(1, 9)).toBe("y")
    expect(decideAxis(60, 9)).toBe("x")
  })
})

describe("the row of pages", () => {
  const width = 390

  it("sits at -page * width, the finger moves it one to one", () => {
    expect(rowOffset({ pos: 0, drag: 0, width, count: 3, rubber: true })).toBe(0)
    expect(rowOffset({ pos: 1, drag: 0, width, count: 3, rubber: true })).toBe(-390)
    expect(rowOffset({ pos: 1, drag: -50, width, count: 3, rubber: true })).toBe(-440)
  })

  it("meets a rubber band before the first and after the last page, not a wall", () => {
    const before = rowOffset({ pos: 0, drag: 200, width, count: 3, rubber: true })
    expect(before).toBeGreaterThan(0)
    expect(before).toBeLessThan(200)
    const after = rowOffset({ pos: 2, drag: -200, width, count: 3, rubber: true })
    expect(after).toBeLessThan(-780)
    expect(after).toBeGreaterThan(-780 - 200)
    expect(rowOffset({ pos: 0, drag: 200, width, count: 3, rubber: false })).toBe(200)
  })

  it("a slow drag of less than half a page falls back, a drag of more goes on", () => {
    const stay = landingPage({ from: 0, x: -120, velocity: -50, width, count: 3 })
    expect(stay.index).toBe(0)
    const go = landingPage({ from: 0, x: -250, velocity: -50, width, count: 3 })
    expect(go.index).toBe(1)
  })

  it("a flick is one page, never three, and only a fast one may overshoot", () => {
    const flick = landingPage({ from: 0, x: -60, velocity: -3000, width, count: 3 })
    expect(flick).toEqual({ index: 1, fling: true })
    const slow = landingPage({ from: 1, x: -400, velocity: -100, width, count: 3 })
    expect(slow.fling).toBe(false)
  })

  it("the last page cannot be thrown past, nor the first", () => {
    expect(landingPage({ from: 2, x: -800, velocity: -3000, width, count: 3 }).index).toBe(2)
    expect(landingPage({ from: 0, x: 80, velocity: 3000, width, count: 3 }).index).toBe(0)
  })

  it("a flick back returns to the page it came from", () => {
    expect(landingPage({ from: 1, x: -330, velocity: 2500, width, count: 3 }).index).toBe(0)
  })

  it("names the page nearest to a position, held between the first and the last", () => {
    expect([-0.4, 0.4, 0.6, 1.4, 1.6, 2.4, 9].map((p) => pageAt(p))).toEqual([0, 0, 1, 1, 2, 2, 2])
  })

  it("the dots' mark moves one step per page and stays inside the dots", () => {
    expect(dotMarkX(0)).toBe(0)
    expect(dotMarkX(1)).toBe(DOT_STEP)
    expect(dotMarkX(1.5)).toBe(DOT_STEP * 1.5)
    expect(dotMarkX(-3)).toBe(0)
    expect(dotMarkX(7)).toBe(DOT_STEP * 2)
  })
})

describe("the height of the window between the pages", () => {
  it("is the height of the page it rests on", () => {
    expect(heightAt(0, [900, 400, 600])).toBe(900)
    expect(heightAt(1, [900, 400, 600])).toBe(400)
    expect(heightAt(2, [900, 400, 600])).toBe(600)
  })

  it("moves smoothly between two pages, so the sections below move once", () => {
    expect(heightAt(0.5, [900, 400, 600])).toBe(650)
    expect(heightAt(1.5, [900, 400, 600])).toBe(500)
  })

  it("never lets the block collapse before the pages are measured, nor read past the ends", () => {
    expect(heightAt(1, [0, 0, 0])).toBe(MIN_VIEW)
    expect(heightAt(-1, [300, 400, 500])).toBe(300)
    expect(heightAt(5, [300, 400, 500])).toBe(500)
    expect(heightAt(0, [])).toBe(MIN_VIEW)
  })
})
