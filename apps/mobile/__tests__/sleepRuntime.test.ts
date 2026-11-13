import { describe, expect, it, vi } from "vitest"

import { createTrackEndHook, type ControllerDeps } from "@/lib/playerV2/controller"
import { createSleepRuntime } from "@/lib/playerV2/sleepRuntime"
import { SLEEP_OFF, startSleepEndOfList, startSleepEndOfSong, startSleepMinutes, type SleepTimer } from "@/lib/playerV2/sleepTimer"

function setup(initial: SleepTimer = SLEEP_OFF, song: number | null = 7) {
  const state = { timer: initial, song, volume: 0.8 }
  const calls = {
    holdNative: vi.fn(),
    releaseNative: vi.fn(),
    pause: vi.fn(),
    rewind: vi.fn(),
    cancel: vi.fn(() => {
      state.timer = SLEEP_OFF
    }),
    setNativeVolume: vi.fn(),
  }
  const runtime = createSleepRuntime({
    getTimer: () => state.timer,
    currentSongNumber: () => state.song,
    getVolume: () => state.volume,
    ...calls,
  })
  return { state, calls, runtime }
}

describe("sleep runtime: end of song", () => {
  it("takes the next song away when armed and gives it back when cancelled", () => {
    const { runtime, calls } = setup()
    runtime.onTimerChange(SLEEP_OFF, startSleepEndOfSong(7))
    expect(calls.holdNative).toHaveBeenCalledTimes(1)
    runtime.onTimerChange(startSleepEndOfSong(7), SLEEP_OFF)
    expect(calls.releaseNative).toHaveBeenCalledTimes(1)
  })

  it("minutes timers never touch the native queue", () => {
    const { runtime, calls } = setup()
    runtime.onTimerChange(SLEEP_OFF, startSleepMinutes(5, 0))
    runtime.onTimerChange(startSleepMinutes(5, 0), SLEEP_OFF)
    expect(calls.holdNative).not.toHaveBeenCalled()
    expect(calls.releaseNative).not.toHaveBeenCalled()
  })

  it("switching from end of song to minutes releases the native queue", () => {
    const { runtime, calls } = setup()
    runtime.onTimerChange(startSleepEndOfSong(7), startSleepMinutes(5, 0))
    expect(calls.releaseNative).toHaveBeenCalledTimes(1)
  })

  it("is active only for the song the timer waits for", () => {
    const { runtime, state } = setup(startSleepEndOfSong(7), 7)
    expect(runtime.controllerSleep.endOfSongActive()).toBe(true)
    state.song = 8
    expect(runtime.controllerSleep.endOfSongActive()).toBe(false)
    state.timer = SLEEP_OFF
    state.song = 7
    expect(runtime.controllerSleep.endOfSongActive()).toBe(false)
  })

  it("the track-end event pauses, rewinds, turns the timer off and stops anything following", () => {
    const { runtime, calls } = setup(startSleepEndOfSong(7), 7)
    const hookDeps = {
      sleep: runtime.controllerSleep,
      getPlayer: () => ({ currentSong: null, queue: [], playbackMode: "casual", playlistBounds: null, position: 0 }),
      getPrefs: () => ({ playMode: "single", repeatMode: "all", versionByNumber: {} }),
    } as unknown as ControllerDeps
    const hook = createTrackEndHook(hookDeps)
    expect(hook.shouldHoldUpcoming()).toBe(true)
    expect(hook.onTrackEnded()).toBe(true)
    expect(calls.pause).toHaveBeenCalledTimes(1)
    expect(calls.rewind).toHaveBeenCalledTimes(1)
    expect(calls.cancel).toHaveBeenCalledTimes(1)
  })
})

describe("sleep runtime: fade", () => {
  it("scales the native volume by the user's volume and only calls when the factor changes", () => {
    const { runtime, calls } = setup(startSleepMinutes(5, 0))
    runtime.setFade(1)
    expect(calls.setNativeVolume).not.toHaveBeenCalled()
    runtime.setFade(0.5)
    runtime.setFade(0.5)
    expect(calls.setNativeVolume).toHaveBeenCalledTimes(1)
    expect(calls.setNativeVolume).toHaveBeenLastCalledWith(0.4)
  })

  it("restores the user's volume when the timer turns off", () => {
    const { runtime, calls } = setup(startSleepMinutes(5, 0))
    runtime.setFade(0.25)
    runtime.onTimerChange(startSleepMinutes(5, 0), SLEEP_OFF)
    expect(calls.setNativeVolume).toHaveBeenLastCalledWith(0.8)
    calls.setNativeVolume.mockClear()
    runtime.onTimerChange(SLEEP_OFF, SLEEP_OFF)
    expect(calls.setNativeVolume).not.toHaveBeenCalled()
  })
})

describe("sleep runtime: end of playlist", () => {
  it("holds the queue only once the last track plays, and gives it back when cancelled", () => {
    const { runtime, calls, state } = setup(SLEEP_OFF, 5)
    state.timer = startSleepEndOfList(9)
    runtime.onTimerChange(SLEEP_OFF, state.timer)
    // an earlier track plays: the queue is left alone
    expect(calls.holdNative).not.toHaveBeenCalled()
    state.song = 9
    runtime.onSongChange()
    expect(calls.holdNative).toHaveBeenCalledTimes(1)
    runtime.onSongChange()
    expect(calls.holdNative).toHaveBeenCalledTimes(1)
    state.timer = SLEEP_OFF
    runtime.onTimerChange(startSleepEndOfList(9), SLEEP_OFF)
    expect(calls.releaseNative).toHaveBeenCalledTimes(1)
  })

  it("is active for the last track only", () => {
    const { runtime, state } = setup(startSleepEndOfList(9), 5)
    expect(runtime.controllerSleep.endOfSongActive()).toBe(false)
    state.song = 9
    expect(runtime.controllerSleep.endOfSongActive()).toBe(true)
  })
})
