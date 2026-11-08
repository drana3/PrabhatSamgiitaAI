import { describe, expect, it } from "vitest"

import { createTransitionFader, fadeLengthFor, FADE_TICK_MS } from "@/lib/playback/transitionFade"
import { createLeveler } from "@/lib/loudness/leveler"

/** A hand-driven clock and timer: nothing real runs. */
function rig(opts: { seconds?: number; hasNext?: boolean; rate?: number } = {}) {
  const state = { t: 0, seconds: opts.seconds ?? 2, hasNext: opts.hasNext ?? true, rate: opts.rate ?? 1 }
  let tick: (() => void) | null = null
  const applied: number[] = []
  const fader = createTransitionFader({
    getSeconds: () => state.seconds,
    hasNext: () => state.hasNext,
    getRate: () => state.rate,
    apply: (f) => applied.push(f),
    now: () => state.t,
    setTimer: (run) => {
      tick = run
      return 1
    },
    clearTimer: () => {
      tick = null
    },
  })
  return {
    state,
    applied,
    fader,
    running: () => tick !== null,
    /** The player plays on from `from` and reports its position once a second, like RNTP does. */
    play(from: number, duration: number, seconds: number) {
      let pos = from
      for (let i = 0; i < seconds; i += 1) {
        this.advance(1000)
        pos += state.rate
        fader.onProgress(pos, duration)
      }
      return pos
    },
    advance(ms: number) {
      const end = state.t + ms
      while (state.t < end) {
        state.t = Math.min(end, state.t + FADE_TICK_MS)
        tick?.()
      }
    },
  }
}

describe("transition fade length", () => {
  it("is off at 0, never longer than a fifth of the track, off for tiny tracks", () => {
    expect(fadeLengthFor(0, 200)).toBe(0)
    expect(fadeLengthFor(6, 200)).toBe(6)
    expect(fadeLengthFor(6, 20)).toBe(4)
    expect(fadeLengthFor(2, 1)).toBe(0)
    expect(fadeLengthFor(2, 0)).toBe(0)
  })
})

describe("transition fade out", () => {
  it("does nothing far from the end", () => {
    const r = rig()
    r.fader.onProgress(30, 200)
    expect(r.applied).toEqual([])
    expect(r.running()).toBe(false)
  })

  it("lowers the volume along an equal-power curve over the last N seconds, between progress reports", () => {
    const r = rig({ seconds: 2 })
    r.fader.onProgress(194, 200) // 6 s to go
    r.play(194, 200, 3) // 3 s to go: inside the look-ahead, the clock runs but the fade has not begun
    expect(r.fader.factor()).toBe(1)
    r.advance(2000) // 1 s left: halfway, cos(45deg)
    expect(r.fader.factor()).toBeCloseTo(Math.SQRT1_2, 1)
    r.advance(1000)
    expect(r.fader.factor()).toBeCloseTo(0, 1)
    // many small steps, not one jump per second
    expect(r.applied.length).toBeGreaterThan(8)
    // never goes up while fading out
    for (let i = 1; i < r.applied.length; i += 1) expect(r.applied[i]).toBeLessThanOrEqual(r.applied[i - 1] + 1e-9)
  })

  it("follows the playback rate (the fade is in real seconds)", () => {
    const r = rig({ seconds: 2, rate: 2 })
    r.fader.onProgress(190, 200) // 10 media seconds = 5 real seconds
    r.play(190, 200, 2) // 6 media s left = 3 real s: look-ahead, fade not started
    expect(r.fader.factor()).toBe(1)
    r.advance(1000) // 4 media s = 2 real s left: the fade starts
    r.advance(1000) // 1 real s left: halfway
    expect(r.fader.factor()).toBeCloseTo(Math.SQRT1_2, 1)
  })

  it("does not fade before nothing (no next track) and gives the volume back", () => {
    const r = rig({ hasNext: false })
    r.fader.onProgress(199, 200)
    expect(r.applied).toEqual([])
    const q = rig()
    q.fader.onProgress(198, 200)
    q.advance(1500)
    expect(q.fader.factor()).toBeLessThan(1)
    q.state.hasNext = false
    q.fader.onProgress(199, 200)
    expect(q.fader.factor()).toBe(1)
  })

  it("restores full volume when the track is rewound after a fade (sleep timer, start over)", () => {
    const r = rig()
    r.fader.onProgress(198, 200)
    r.advance(2000)
    expect(r.fader.factor()).toBeLessThan(0.5)
    r.fader.onProgress(0, 200)
    expect(r.fader.factor()).toBe(1)
    expect(r.running()).toBe(false)
  })

  it("is off when the setting is 0", () => {
    const r = rig({ seconds: 0 })
    r.fader.onProgress(199, 200)
    r.advance(2000)
    expect(r.applied).toEqual([])
  })
})

describe("transition fade in", () => {
  it("brings the next track up over the same length when the track ended by itself", () => {
    const r = rig({ seconds: 2 })
    r.fader.onProgress(198, 200)
    r.advance(2000)
    r.fader.onTrackChanged(false)
    expect(r.fader.factor()).toBe(0)
    r.advance(1000)
    expect(r.fader.factor()).toBeCloseTo(Math.SQRT1_2, 1)
    r.advance(1100)
    expect(r.fader.factor()).toBe(1)
    expect(r.running()).toBe(false)
  })

  it("a track change by the listener starts at full volume", () => {
    const r = rig({ seconds: 2 })
    r.fader.onProgress(198, 200)
    r.advance(1500)
    r.fader.onTrackChanged(true)
    expect(r.fader.factor()).toBe(1)
    expect(r.running()).toBe(false)
  })

  it("a change in the middle of a track needs no fade", () => {
    const r = rig()
    r.fader.onProgress(50, 200)
    r.fader.onTrackChanged(false)
    expect(r.applied).toEqual([])
  })
})

describe("the fade is a multiplier on the levelled volume", () => {
  it("volume = user volume x leveling gain x fade", () => {
    const volumes: number[] = []
    const leveler = createLeveler({ setVolume: (v) => volumes.push(v), isEnabled: () => false })
    leveler.setUserVolume(0.8)
    leveler.setFade(0.5)
    expect(volumes.at(-1)).toBeCloseTo(0.4, 5)
    leveler.setFade(1)
    expect(volumes.at(-1)).toBeCloseTo(0.8, 5)
    leveler.setFade(0.25)
    leveler.reset()
    // reset gives the fade back; the user's slider stays where the listener put it
    expect(volumes.at(-1)).toBeCloseTo(0.8, 5)
  })
})
