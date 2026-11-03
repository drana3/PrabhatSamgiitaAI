import { describe, expect, it, vi } from "vitest"

import {
  resumePositionFor,
  shouldApplyResume,
  shouldSaveResume,
  upsertResume,
} from "@/lib/playerV2/resume"
import { createResumeTracker } from "@/lib/playerV2/resumeTracker"

describe("resume position", () => {
  it("ignores the first seconds and the tail", () => {
    expect(resumePositionFor(undefined)).toBeNull()
    expect(resumePositionFor({ position: 3, duration: 200, savedAt: 0 })).toBeNull()
    expect(resumePositionFor({ position: 195, duration: 200, savedAt: 0 })).toBeNull()
    expect(resumePositionFor({ position: 90.7, duration: 200, savedAt: 0 })).toBe(90)
  })

  it("saves at most every five seconds", () => {
    expect(shouldSaveResume(3, null)).toBe(false)
    expect(shouldSaveResume(10, null)).toBe(true)
    expect(shouldSaveResume(12, 10)).toBe(false)
    expect(shouldSaveResume(16, 10)).toBe(true)
  })

  it("stores, drops finished songs and evicts the oldest", () => {
    let map = upsertResume({}, 1, 60, 200, 100)
    expect(map["1"]).toEqual({ position: 60, duration: 200, savedAt: 100 })
    map = upsertResume(map, 1, 199, 200, 200)
    expect(map["1"]).toBeUndefined()
    map = upsertResume({}, 1, 60, 200, 1, 2)
    map = upsertResume(map, 2, 60, 200, 2, 2)
    map = upsertResume(map, 3, 60, 200, 3, 2)
    expect(Object.keys(map).sort()).toEqual(["2", "3"])
  })

  it("applies the saved position only once the track is really playing", () => {
    const base = { alreadyApplied: false, isBuffering: false, position: 0, duration: 200, target: 90 }
    expect(shouldApplyResume(base)).toBe(true)
    expect(shouldApplyResume({ ...base, isBuffering: true })).toBe(false)
    expect(shouldApplyResume({ ...base, duration: 1 })).toBe(false)
    expect(shouldApplyResume({ ...base, alreadyApplied: true })).toBe(false)
    expect(shouldApplyResume({ ...base, target: null })).toBe(false)
    expect(shouldApplyResume({ ...base, position: 89.5 })).toBe(false)
  })
})

describe("resume tracker", () => {
  const obs = (over: Partial<Parameters<ReturnType<typeof createResumeTracker>>[0]>) => ({
    songNumber: 5,
    position: 0,
    duration: 200,
    isPlaying: true,
    isBuffering: false,
    ...over,
  })

  it("restores once, never saves the engine's zero, then saves progress and pause", () => {
    const record = vi.fn()
    const seekTo = vi.fn()
    const feed = createResumeTracker({
      getEntry: () => ({ position: 90, duration: 200, savedAt: 0 }),
      record,
      seekTo,
    })
    feed(obs({ isBuffering: true, duration: 300 }))
    feed(obs({ isBuffering: true, duration: 300, position: 0 }))
    expect(seekTo).not.toHaveBeenCalled()
    feed(obs({ position: 0 }))
    expect(seekTo).toHaveBeenCalledWith(90)
    feed(obs({ position: 2 }))
    expect(record).not.toHaveBeenCalled()
    feed(obs({ position: 91 }))
    expect(record).toHaveBeenCalledWith(5, 91, 200)
    feed(obs({ position: 93 }))
    expect(record).toHaveBeenCalledTimes(1)
    feed(obs({ position: 94, isPlaying: false }))
    expect(record).toHaveBeenCalledTimes(2)
    expect(seekTo).toHaveBeenCalledTimes(1)
  })

  it("starts from zero for a song with nothing saved and saves after five seconds", () => {
    const record = vi.fn()
    const seekTo = vi.fn()
    const feed = createResumeTracker({ getEntry: () => undefined, record, seekTo })
    feed(obs({}))
    feed(obs({ position: 3 }))
    expect(record).not.toHaveBeenCalled()
    feed(obs({ position: 6 }))
    expect(record).toHaveBeenCalledWith(5, 6, 200)
    expect(seekTo).not.toHaveBeenCalled()
  })

  it("restores again for the next song", () => {
    const seekTo = vi.fn()
    const entries: Record<number, { position: number; duration: number; savedAt: number }> = {
      5: { position: 50, duration: 200, savedAt: 0 },
      6: { position: 70, duration: 200, savedAt: 0 },
    }
    const feed = createResumeTracker({ getEntry: (n) => entries[n], record: vi.fn(), seekTo })
    feed(obs({ songNumber: 5 }))
    feed(obs({ songNumber: 5 }))
    feed(obs({ songNumber: 6 }))
    feed(obs({ songNumber: 6 }))
    expect(seekTo.mock.calls).toEqual([[50], [70]])
  })
})
