import { describe, expect, it } from "vitest"

import {
  formatBytes,
  formatClock,
  formatRemaining,
  knownDuration,
  playButtonState,
} from "@/lib/playerV2/transportState"
import { projectMomentum } from "@/constants/tokens/amMotion"
import {
  project,
  rubberBand,
  rubberBandClamp,
  scrubRatio,
  secondsFromRatio,
  settleSnap,
  swipeRemoves,
} from "@/lib/playerV2/gesture"

describe("play button", () => {
  it("shows a spinner while loading or buffering, never a pause icon", () => {
    expect(playButtonState({ isPlaying: true, isBuffering: true, audioError: null })).toBe("spinner")
    expect(playButtonState({ isPlaying: false, isBuffering: true, audioError: null })).toBe("spinner")
    expect(playButtonState({ isPlaying: true, isBuffering: false, audioError: null })).toBe("pause")
    expect(playButtonState({ isPlaying: false, isBuffering: false, audioError: null })).toBe("play")
    expect(playButtonState({ isPlaying: false, isBuffering: false, audioError: "x" })).toBe("error")
  })
})

describe("time", () => {
  it("hides the duration until it is known", () => {
    expect(knownDuration({ duration: 0, position: 0, isBuffering: true, placeholder: 300 })).toBeNull()
    expect(knownDuration({ duration: 1, position: 0, isBuffering: false, placeholder: 300 })).toBeNull()
    expect(knownDuration({ duration: 300, position: 0, isBuffering: true, placeholder: 300 })).toBeNull()
    expect(knownDuration({ duration: 300, position: 12, isBuffering: false, placeholder: 300 })).toBe(300)
    expect(knownDuration({ duration: 238, position: 0, isBuffering: true, placeholder: 300 })).toBe(238)
  })

  it("formats clocks", () => {
    expect(formatClock(0)).toBe("0:00")
    expect(formatClock(75.9)).toBe("1:15")
    expect(formatClock(3725)).toBe("1:02:05")
    expect(formatClock(Number.NaN)).toBe("0:00")
    expect(formatRemaining(75, 238)).toBe("-2:43")
    expect(formatBytes(3_900_000)).toBe("3.7 MB")
    expect(formatBytes(2048)).toBe("2 KB")
  })
})

describe("scrub and sheet physics", () => {
  it("uses the spec's momentum projection", () => {
    for (const [x, v] of [[0, 0], [100, 1500], [700, -900]] as const) {
      expect(project(x, v)).toBeCloseTo(projectMomentum(x, v), 9)
    }
  })

  it("scrubs 1:1 from where the thumb was grabbed", () => {
    const base = { width: 300, startRatio: 0.5, thumbRadius: 22 }
    expect(scrubRatio({ ...base, touchDownX: 150, touchX: 150 })).toBeCloseTo(0.5)
    expect(scrubRatio({ ...base, touchDownX: 160, touchX: 190 })).toBeCloseTo(0.6)
    expect(scrubRatio({ ...base, touchDownX: 150, touchX: 1000 })).toBe(1)
    expect(scrubRatio({ ...base, touchDownX: 150, touchX: -500 })).toBe(0)
  })

  it("jumps under the finger when the track is touched away from the thumb", () => {
    const base = { width: 300, startRatio: 0.5, thumbRadius: 22 }
    expect(scrubRatio({ ...base, touchDownX: 60, touchX: 60 })).toBeCloseTo(0.2)
    expect(scrubRatio({ ...base, touchDownX: 60, touchX: 90 })).toBeCloseTo(0.3)
  })

  it("maps ratio to seconds", () => {
    expect(secondsFromRatio(0.5, 200)).toBe(100)
    expect(secondsFromRatio(2, 200)).toBe(200)
    expect(secondsFromRatio(0.5, 0)).toBe(0)
  })

  it("resists past the edge instead of a hard stop", () => {
    expect(rubberBand(0, 100)).toBe(0)
    const a = rubberBand(50, 100)
    const b = rubberBand(500, 100)
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(50)
    expect(b).toBeLessThan(100)
    expect(b).toBeGreaterThan(a)
    expect(rubberBandClamp(50, 0, 100, 80)).toBe(50)
    expect(rubberBandClamp(-60, 0, 100, 80)).toBeLessThan(0)
    expect(rubberBandClamp(-60, 0, 100, 80)).toBeGreaterThan(-60)
    expect(rubberBandClamp(160, 0, 100, 80)).toBeGreaterThan(100)
  })

  it("settles a sheet on the snap nearest to the momentum projection", () => {
    const snaps = [0, 400, 800]
    expect(settleSnap(300, 0, snaps)).toBe(400)
  })

  it("a flick carries a sheet past a nearer snap", () => {
    const snaps = [0, 400, 800]
    expect(settleSnap(100, 0, snaps)).toBe(0)
    // 1500 px/s projects 100 + 1.5 * 499 = 848, so the sheet lands on 800
    expect(settleSnap(100, 1500, snaps)).toBe(800)
    expect(settleSnap(700, -1500, snaps)).toBe(0)
  })

  it("swipe to remove uses the projected landing", () => {
    expect(swipeRemoves(-20, 0, 120)).toBe(false)
    expect(swipeRemoves(-20, -600, 120)).toBe(true)
    expect(swipeRemoves(-130, 0, 120)).toBe(true)
  })
})
