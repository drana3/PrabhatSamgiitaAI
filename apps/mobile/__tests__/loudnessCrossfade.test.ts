import { describe, expect, it } from "vitest"

import {
  MAX_LEVEL_GAP_DB,
  PRELOAD_LEAD_SECONDS,
  clampCrossfadeSeconds,
  equalPowerCurves,
  equalPowerGains,
  fadeIsDue,
  fadeProgress,
  linearGains,
  mixedPower,
  planTransition,
  shouldPreload,
  type TrackFacts,
} from "@/lib/loudness/crossfade"

const facts = (over: Partial<TrackFacts> = {}): TrackFacts => ({ duration: 240, cls: "music", levelledLufs: -14, ...over })
const plan = (over: { current?: Partial<TrackFacts>; next?: Partial<TrackFacts> | null; seconds?: number; enabled?: boolean } = {}) =>
  planTransition({
    current: facts(over.current),
    next: over.next === null ? null : facts(over.next),
    requestedSeconds: over.seconds ?? 2,
    enabled: over.enabled ?? true,
  })

describe("fade curves", () => {
  it("equal power keeps the total power at 1 along the whole fade", () => {
    for (let i = 0; i <= 100; i += 1) {
      expect(mixedPower(equalPowerGains(i / 100))).toBeCloseTo(1, 9)
    }
  })
  it("linear fades dip 3 dB in the middle (the reason they are not used)", () => {
    const p = mixedPower(linearGains(0.5))
    expect(p).toBeCloseTo(0.5, 9)
    expect(10 * Math.log10(p)).toBeCloseTo(-3.0103, 3)
  })
  it("starts with the old track alone and ends with the new one alone", () => {
    expect(equalPowerGains(0)).toEqual({ out: 1, in: 0 })
    const end = equalPowerGains(1)
    expect(end.out).toBeCloseTo(0, 12)
    expect(end.in).toBeCloseTo(1, 12)
  })
  it("clamps t and survives NaN", () => {
    expect(equalPowerGains(-5)).toEqual({ out: 1, in: 0 })
    expect(equalPowerGains(Number.NaN)).toEqual({ out: 1, in: 0 })
    expect(equalPowerGains(9).in).toBeCloseTo(1, 12)
  })
  it("builds Float32 curves for setValueCurveAtTime: monotone, at least 2 points, power ~1 at every point", () => {
    const c = equalPowerCurves(64)
    expect(c.out).toBeInstanceOf(Float32Array)
    expect(c.out.length).toBe(64)
    for (let i = 0; i < 64; i += 1) {
      expect(c.out[i]! ** 2 + c.in[i]! ** 2).toBeCloseTo(1, 5)
      if (i > 0) {
        expect(c.out[i]!).toBeLessThanOrEqual(c.out[i - 1]!)
        expect(c.in[i]!).toBeGreaterThanOrEqual(c.in[i - 1]!)
      }
    }
    expect(equalPowerCurves(0).out.length).toBe(2)
  })
  it("fade progress is clamped", () => {
    expect(fadeProgress(1, 2)).toBe(0.5)
    expect(fadeProgress(5, 2)).toBe(1)
    expect(fadeProgress(-1, 2)).toBe(0)
    expect(fadeProgress(1, 0)).toBe(1)
  })
})

describe("clampCrossfadeSeconds", () => {
  it("keeps the fade between 1 and 3 seconds, default 2", () => {
    expect(clampCrossfadeSeconds(0)).toBe(1)
    expect(clampCrossfadeSeconds(12)).toBe(3)
    expect(clampCrossfadeSeconds(2.5)).toBe(2.5)
    expect(clampCrossfadeSeconds(undefined)).toBe(2)
    expect(clampCrossfadeSeconds(Number.NaN)).toBe(2)
  })
})

describe("planTransition", () => {
  it("crossfades two levelled tracks of one class, starting a fade-length before the end", () => {
    const p = plan()
    expect(p).toEqual({ mode: "crossfade", fadeSeconds: 2, startAtSeconds: 238 })
  })
  it("is gapless when there is no next track", () => {
    expect(plan({ next: null })).toEqual({ mode: "gapless", reason: "no-next" })
  })
  it("is gapless when leveling is off", () => {
    expect(plan({ enabled: false })).toEqual({ mode: "gapless", reason: "disabled" })
  })
  it("never mixes a discourse into music", () => {
    expect(plan({ next: { cls: "speech" } })).toEqual({ mode: "gapless", reason: "class-change" })
  })
  it("does not overlap tracks whose levels differ by more than the gap", () => {
    expect(plan({ next: { levelledLufs: -14 + MAX_LEVEL_GAP_DB + 0.1 } })).toEqual({ mode: "gapless", reason: "level-gap" })
    expect(plan({ next: { levelledLufs: -14 + MAX_LEVEL_GAP_DB } }).mode).toBe("crossfade")
  })
  it("does not overlap a track that was not measured", () => {
    expect(plan({ next: { levelledLufs: null } })).toEqual({ mode: "gapless", reason: "level-gap" })
    expect(plan({ current: { levelledLufs: null } })).toEqual({ mode: "gapless", reason: "level-gap" })
  })
  it("does not guess at tracks of unknown length", () => {
    expect(plan({ next: { duration: null } })).toEqual({ mode: "gapless", reason: "unknown-length" })
    expect(plan({ current: { duration: 0 } })).toEqual({ mode: "gapless", reason: "unknown-length" })
  })
  it("shortens the fade for a short track (at most a fifth of it) and skips it when too short", () => {
    const short = plan({ next: { duration: 8 }, seconds: 3 })
    expect(short.mode).toBe("crossfade")
    if (short.mode === "crossfade") expect(short.fadeSeconds).toBeCloseTo(1.6, 6)
    expect(plan({ next: { duration: 2 } })).toEqual({ mode: "gapless", reason: "too-short" })
  })
})

describe("shouldPreload", () => {
  it("loads the next track when 25 seconds remain, not before, and only once", () => {
    const base = { duration: 240, hasNext: true, alreadyLoaded: false }
    expect(shouldPreload({ ...base, position: 100 })).toBe(false)
    expect(shouldPreload({ ...base, position: 240 - PRELOAD_LEAD_SECONDS })).toBe(true)
    expect(shouldPreload({ ...base, position: 239, alreadyLoaded: true })).toBe(false)
    expect(shouldPreload({ ...base, position: 239, hasNext: false })).toBe(false)
  })
  it("a short track preloads from its middle; an unknown length after 5 seconds", () => {
    expect(shouldPreload({ position: 9, duration: 30, hasNext: true, alreadyLoaded: false })).toBe(false)
    expect(shouldPreload({ position: 15, duration: 30, hasNext: true, alreadyLoaded: false })).toBe(true)
    expect(shouldPreload({ position: 4, duration: null, hasNext: true, alreadyLoaded: false })).toBe(false)
    expect(shouldPreload({ position: 6, duration: null, hasNext: true, alreadyLoaded: false })).toBe(true)
  })
  it("fadeIsDue only for a crossfade plan at or after its start", () => {
    const p = plan()
    expect(fadeIsDue(p, 237.9)).toBe(false)
    expect(fadeIsDue(p, 238)).toBe(true)
    expect(fadeIsDue({ mode: "gapless", reason: "disabled" }, 999)).toBe(false)
  })
})
