import { describe, expect, it, vi } from "vitest"

import {
  formatSleepRemaining,
  sleepLabel,
  sleepRemainingMs,
  sleepVerdict,
  SLEEP_OFF,
  startSleepEndOfSong,
  startSleepMinutes,
} from "@/lib/playerV2/sleepTimer"
import { tickSleep } from "@/lib/playerV2/sleepWatcher"
import { clampRate, formatRate, nextRate, SPEED_STEPS } from "@/lib/playerV2/playbackSpeed"

describe("sleep timer", () => {
  const t0 = 1_000_000
  it("counts down and fires at the end", () => {
    const timer = startSleepMinutes(5, t0)
    expect(sleepRemainingMs(timer, t0 + 60_000)).toBe(240_000)
    expect(sleepLabel(timer, t0 + 60_000)).toBe("4:00")
    const snap = { now: t0, songNumber: 1, position: 10, duration: 200 }
    expect(sleepVerdict(timer, snap)).toBe("keep-going")
    expect(sleepVerdict(timer, { ...snap, now: t0 + 5 * 60_000 })).toBe("pause")
  })

  it("end of song pauses in the last second", () => {
    const timer = startSleepEndOfSong(7)
    const snap = { now: 0, songNumber: 7, position: 100, duration: 200 }
    expect(sleepVerdict(timer, snap)).toBe("keep-going")
    expect(sleepVerdict(timer, { ...snap, position: 199.5 })).toBe("pause")
  })

  it("end of song pauses and rewinds the next song if the engine already moved on", () => {
    const timer = startSleepEndOfSong(7)
    expect(sleepVerdict(timer, { now: 0, songNumber: 8, position: 1, duration: 200 })).toBe(
      "pause-and-rewind",
    )
  })

  it("does not fire for an unknown duration", () => {
    const timer = startSleepEndOfSong(7)
    expect(sleepVerdict(timer, { now: 0, songNumber: 7, position: 1, duration: 1 })).toBe("keep-going")
  })

  it("formats and labels", () => {
    expect(formatSleepRemaining(61_000)).toBe("1:01")
    expect(sleepLabel(SLEEP_OFF, 0)).toBe("Off")
    expect(sleepLabel(startSleepEndOfSong(1), 0)).toBe("End of song")
  })

  it("the watcher stops playback once and turns the timer off", () => {
    const pause = vi.fn()
    const rewind = vi.fn()
    const cancel = vi.fn()
    const timer = startSleepMinutes(5, 0)
    tickSleep({
      getTimer: () => timer,
      snapshot: () => ({ now: 6 * 60_000, songNumber: 1, position: 5, duration: 100 }),
      pause,
      rewind,
      cancel,
    })
    expect(pause).toHaveBeenCalledTimes(1)
    expect(rewind).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledTimes(1)

    const idle = vi.fn()
    tickSleep({ getTimer: () => SLEEP_OFF, snapshot: () => ({ now: 0, songNumber: 1, position: 0, duration: 0 }), pause: idle, rewind: idle, cancel: idle })
    expect(idle).not.toHaveBeenCalled()
  })

  it("the watcher rewinds when the song changed", () => {
    const rewind = vi.fn()
    tickSleep({
      getTimer: () => startSleepEndOfSong(1),
      snapshot: () => ({ now: 0, songNumber: 2, position: 1, duration: 100 }),
      pause: vi.fn(),
      rewind,
      cancel: vi.fn(),
    })
    expect(rewind).toHaveBeenCalledTimes(1)
  })
})

describe("playback speed", () => {
  it("stays between 0.5x and 1.5x", () => {
    expect(clampRate(0.1)).toBe(0.5)
    expect(clampRate(3)).toBe(1.5)
    expect(clampRate(Number.NaN)).toBe(1)
    expect(clampRate(1.254)).toBe(1.25)
  })

  it("cycles through the steps", () => {
    expect(SPEED_STEPS).toEqual([0.5, 0.75, 1, 1.25, 1.5])
    expect(nextRate(1)).toBe(1.25)
    expect(nextRate(1.5)).toBe(0.5)
    expect(nextRate(0.9)).toBe(1)
    expect(formatRate(1)).toBe("1x")
    expect(formatRate(0.75)).toBe("0.75x")
  })
})
