import { beforeEach, describe, expect, it } from "vitest"

import { PRE_DUCK_SECONDS, RAMP_MS, RAMP_STEP_MS, createLeveler, type Leveler } from "@/lib/loudness/leveler"
import type { CatalogTrack } from "@/lib/playback/catalogTrack"

// A hand-driven clock: timers run only when the test says so.
function harness(options: { enabled?: boolean } = {}) {
  let enabled = options.enabled ?? true
  let clock = 0
  let nextHandle = 1
  const timers = new Map<number, { at: number; run: () => void }>()
  const volumes: number[] = []
  const leveler = createLeveler({
    setVolume: (v) => volumes.push(v),
    isEnabled: () => enabled,
    setTimer: (run, ms) => {
      const handle = nextHandle++
      timers.set(handle, { at: clock + ms, run })
      return handle
    },
    clearTimer: (handle) => void timers.delete(handle as number),
  })
  const advance = (ms: number) => {
    const end = clock + ms
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      clock = due[1].at
      due[1].run()
    }
    clock = end
  }
  return { leveler, volumes, advance, setEnabled: (v: boolean) => (enabled = v), pending: () => timers.size, last: () => volumes[volumes.length - 1] }
}

const track = (id: string, lufs: number | undefined, extra: Partial<CatalogTrack> = {}): CatalogTrack => ({
  id,
  url: `https://example.com/${id}.mp3`,
  title: id,
  ...(lufs === undefined ? {} : { loudnessLufs: lufs, truePeakDb: -3 }),
  loudnessClass: "music",
  ...extra,
})
const gain = (db: number) => 10 ** (db / 20)

describe("leveler: a track starts", () => {
  let h: ReturnType<typeof harness>
  beforeEach(() => (h = harness()))

  it("applies the gain of a loud track at once, before it is heard", () => {
    h.leveler.startTrack(track("a", -8)) // -8 -> -18: -10 dB
    expect(h.last()).toBeCloseTo(gain(-10), 6)
    expect(h.leveler.gainDb()).toBe(-10)
  })
  it("leaves an unmeasured track at the listener's own volume", () => {
    h.leveler.setUserVolume(0.8)
    h.leveler.startTrack(track("a", undefined))
    expect(h.last()).toBeCloseTo(0.8, 9)
  })
  it("does not touch the volume when leveling is off", () => {
    const off = harness({ enabled: false })
    off.leveler.startTrack(track("a", -8))
    expect(off.last()).toBe(1)
  })
  it("cancels a ramp that was still running", () => {
    h.leveler.startTrack(track("a", -8))
    h.leveler.noteUpcoming(track("b", -18))
    h.leveler.onActiveTrackChanged("b")
    h.advance(RAMP_STEP_MS)
    h.leveler.startTrack(track("c", -10))
    h.advance(1000)
    expect(h.last()).toBeCloseTo(gain(-8), 6)
    expect(h.pending()).toBe(0)
  })
})

describe("leveler: the volume slider", () => {
  it("multiplies in the listener's volume and applies it at once", () => {
    const h = harness()
    h.leveler.startTrack(track("a", -8)) // -10 dB
    h.leveler.setUserVolume(0.5)
    expect(h.last()).toBeCloseTo(0.5 * gain(-10), 6)
    h.leveler.setUserVolume(7)
    expect(h.last()).toBeCloseTo(gain(-10), 6) // clamped to 1
    h.leveler.setUserVolume(Number.NaN)
    expect(h.last()).toBeCloseTo(gain(-10), 6)
  })
  it("never sends a volume above 1", () => {
    const h = harness()
    h.leveler.startTrack(track("a", -30)) // quiet: native cannot boost
    h.leveler.setUserVolume(1)
    for (const v of h.volumes) expect(v).toBeLessThanOrEqual(1)
  })
})

describe("leveler: the join between two tracks", () => {
  it("after the join a quieter-needed track ramps UP smoothly, with no step", () => {
    const h = harness()
    h.leveler.startTrack(track("loud", -8)) // -10 dB
    h.leveler.noteUpcoming(track("soft", -17)) // -1 dB
    h.volumes.length = 0
    h.leveler.onActiveTrackChanged("soft")
    h.advance(RAMP_MS + RAMP_STEP_MS)
    expect(h.volumes.length).toBeGreaterThan(3)
    // monotone rise to the target in steps of about 1 dB (a 9 dB change over 8 steps), never one jump
    for (let i = 1; i < h.volumes.length; i += 1) {
      expect(h.volumes[i]!).toBeGreaterThanOrEqual(h.volumes[i - 1]!)
      expect(20 * Math.log10(h.volumes[i]! / h.volumes[i - 1]!)).toBeLessThan(1.3)
    }
    expect(h.last()).toBeCloseTo(gain(-1), 6)
  })

  it("lowers the volume BEFORE a louder successor starts (the pre-duck), so it never starts at the old volume", () => {
    const h = harness()
    h.leveler.startTrack(track("soft", -17)) // -1 dB
    h.leveler.noteUpcoming(track("loud", -8)) // -10 dB
    h.leveler.onProgress("soft", 100, 240) // far from the end: nothing happens
    expect(h.leveler.gainDb()).toBe(-1)
    h.leveler.onProgress("soft", 240 - PRE_DUCK_SECONDS + 0.1, 240)
    h.advance(RAMP_MS + RAMP_STEP_MS)
    expect(h.leveler.gainDb()).toBeCloseTo(-10, 6)
    expect(h.last()).toBeCloseTo(gain(-10), 6)
    // when the player then reports the new track, there is nothing left to change
    const before = h.volumes.length
    h.leveler.onActiveTrackChanged("loud")
    h.advance(RAMP_MS)
    expect(h.last()).toBeCloseTo(gain(-10), 6)
    expect(h.volumes.slice(before).every((v) => Math.abs(v - gain(-10)) < 1e-6)).toBe(true)
  })

  it("ducks only once per track end", () => {
    const h = harness()
    h.leveler.startTrack(track("soft", -17))
    h.leveler.noteUpcoming(track("loud", -8))
    h.leveler.onProgress("soft", 239, 240)
    h.advance(1000)
    const count = h.volumes.length
    h.leveler.onProgress("soft", 239.5, 240)
    h.advance(1000)
    expect(h.volumes.length).toBe(count)
  })

  it("does not duck for a successor that needs the same or a smaller cut", () => {
    const h = harness()
    h.leveler.startTrack(track("a", -10))
    h.leveler.noteUpcoming(track("b", -10.2))
    h.leveler.onProgress("a", 239, 240)
    h.advance(500)
    expect(h.leveler.gainDb()).toBe(-8)
  })

  it("a louder track after a skip is cut at once (too loud is worse than a moment too quiet)", () => {
    const h = harness()
    h.leveler.startTrack(track("soft", -17))
    h.leveler.noteUpcoming(track("loud", -8))
    h.volumes.length = 0
    h.leveler.onActiveTrackChanged("loud")
    expect(h.volumes).toHaveLength(1)
    expect(h.last()).toBeCloseTo(gain(-10), 6)
  })

  it("a track nothing is known about plays as it is", () => {
    const h = harness()
    h.leveler.startTrack(track("a", -8))
    h.leveler.onActiveTrackChanged("mystery")
    h.advance(RAMP_MS + RAMP_STEP_MS)
    expect(h.last()).toBe(1)
  })

  it("ignores progress of a track that is not the active one, and unknown lengths", () => {
    const h = harness()
    h.leveler.startTrack(track("a", -17))
    h.leveler.noteUpcoming(track("b", -8))
    h.leveler.onProgress("zzz", 239, 240)
    h.leveler.onProgress("a", 5, 0)
    h.leveler.onProgress(null, 239, 240)
    h.advance(1000)
    expect(h.leveler.gainDb()).toBe(-1)
  })

  it("an interrupted ramp restarts from the value on screen, not from its target", () => {
    const h = harness()
    h.leveler.startTrack(track("a", -8)) // -10
    h.leveler.noteUpcoming(track("b", -18)) // 0
    h.leveler.onActiveTrackChanged("b")
    h.advance(RAMP_STEP_MS * 3)
    const midway = h.leveler.gainDb()
    expect(midway).toBeGreaterThan(-10)
    expect(midway).toBeLessThan(0)
    h.leveler.noteUpcoming(track("c", -8))
    h.leveler.onActiveTrackChanged("c") // cut: from `midway` straight to -10
    expect(h.leveler.gainDb()).toBe(-10)
  })
})

describe("leveler: the switch", () => {
  it("refresh applies the neutral volume when it is turned off, and the gain again when on", () => {
    const h = harness()
    h.leveler.startTrack(track("a", -8))
    expect(h.leveler.gainDb()).toBe(-10)
    h.setEnabled(false)
    h.leveler.refresh()
    expect(h.last()).toBe(1)
    expect(h.leveler.gainDb()).toBe(0)
    h.setEnabled(true)
    h.leveler.refresh()
    expect(h.last()).toBeCloseTo(gain(-10), 6)
  })
  it("reset forgets everything", () => {
    const h = harness()
    h.leveler.startTrack(track("a", -8))
    h.leveler.reset()
    expect(h.last()).toBe(1)
    expect(h.leveler.activeLevel()).toBeNull()
  })
  it("reports what it knows about the active track", () => {
    const h = harness()
    h.leveler.startTrack(track("a", -22))
    expect(h.leveler.activeLevel()?.reason).toBe("cannot-boost")
  })
  it("speech has its own reference", () => {
    const h = harness()
    h.leveler.startTrack(track("talk", -10, { loudnessClass: "speech" }))
    expect(h.leveler.gainDb()).toBe(-10) // -10 -> -20
  })
})

export type { Leveler }
