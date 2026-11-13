import { describe, expect, it, vi } from "vitest"

import {
  createLongResumeRecorder,
  isLongRecording,
  longOfferVisible,
  longResumeOffer,
  shouldSaveLong,
} from "@/lib/playerV2/longResume"
import type { ResumeEntry } from "@/lib/playerV2/resume"

const entry = (position: number, duration = 1800): ResumeEntry => ({ position, duration, savedAt: 0 })

describe("long recording: when to offer", () => {
  it("only recordings over 10 minutes are long", () => {
    expect(isLongRecording(600)).toBe(false)
    expect(isLongRecording(601)).toBe(true)
    expect(isLongRecording(null)).toBe(false)
    expect(isLongRecording(Number.NaN)).toBe(false)
  })

  it("offers the saved second when it is past 10 s and not at the end", () => {
    expect(longResumeOffer(entry(760))).toBe(760)
    expect(longResumeOffer(entry(10))).toBeNull()
    expect(longResumeOffer(entry(11))).toBe(11)
    expect(longResumeOffer(entry(1771))).toBeNull()
    expect(longResumeOffer(entry(1769))).toBe(1769)
  })

  it("does not offer for a short recording or when nothing is saved", () => {
    expect(longResumeOffer(entry(200, 300))).toBeNull()
    expect(longResumeOffer(undefined)).toBeNull()
  })

  it("saves only long recordings, past 10 s, every 10 s", () => {
    expect(shouldSaveLong(5, 1800, null)).toBe(false)
    expect(shouldSaveLong(20, 300, null)).toBe(false)
    expect(shouldSaveLong(20, 1800, null)).toBe(true)
    expect(shouldSaveLong(25, 1800, 20)).toBe(false)
    expect(shouldSaveLong(31, 1800, 20)).toBe(true)
  })

  it("the offer stays only near the start of the recording it was made for", () => {
    const offer = { songNumber: 9, at: 760 }
    expect(longOfferVisible(offer, 9, 2)).toBe(true)
    expect(longOfferVisible(offer, 9, 25)).toBe(false)
    expect(longOfferVisible(offer, 8, 2)).toBe(false)
    expect(longOfferVisible({ songNumber: null, at: 0 }, 9, 2)).toBe(false)
  })
})

describe("long recording recorder", () => {
  function setup(saved?: ResumeEntry) {
    const store = new Map<number, ResumeEntry>()
    if (saved) store.set(9, saved)
    const deps = {
      getEntry: (n: number) => store.get(n),
      record: vi.fn((n: number, p: number, d: number) => store.set(n, { position: p, duration: d, savedAt: 0 })),
      offer: vi.fn(),
      clearOffer: vi.fn(),
    }
    return { deps, observe: createLongResumeRecorder(deps), store }
  }
  const obs = (position: number, extra = {}) => ({ songNumber: 9, position, duration: 1800, isPlaying: true, isBuffering: false, ...extra })

  it("makes the offer once when a recording with a saved place starts, and does not jump", () => {
    const { deps, observe } = setup(entry(760))
    observe(obs(0))
    expect(deps.offer).toHaveBeenCalledWith(9, 760)
    observe(obs(1))
    expect(deps.offer).toHaveBeenCalledTimes(1)
  })

  it("never overwrites the saved place while the offer waits near the start", () => {
    const { deps, observe } = setup(entry(760))
    observe(obs(0))
    observe(obs(15))
    expect(deps.record).not.toHaveBeenCalled()
  })

  it("saves the place as it plays and on pause", () => {
    const { deps, observe } = setup()
    observe(obs(0))
    expect(deps.offer).not.toHaveBeenCalled()
    observe(obs(12))
    expect(deps.record).toHaveBeenLastCalledWith(9, 12, 1800)
    observe(obs(16))
    expect(deps.record).toHaveBeenCalledTimes(1)
    observe(obs(40, { isPlaying: false }))
    expect(deps.record).toHaveBeenLastCalledWith(9, 40, 1800)
  })

  it("ignores buffering and recordings it does not apply to", () => {
    const { deps, observe } = setup()
    observe(obs(0))
    observe(obs(50, { isBuffering: true }))
    expect(deps.record).not.toHaveBeenCalled()
    const n = setup()
    n.observe({ songNumber: null, position: 100, duration: 1800, isPlaying: true, isBuffering: false })
    n.observe({ songNumber: null, position: 120, duration: 1800, isPlaying: true, isBuffering: false })
    expect(n.deps.record).not.toHaveBeenCalled()
  })

  it("a new recording clears the old offer", () => {
    const { deps, observe } = setup(entry(760))
    observe(obs(0))
    observe({ ...obs(0), songNumber: 10 })
    expect(deps.clearOffer).toHaveBeenCalledTimes(2)
  })
})
