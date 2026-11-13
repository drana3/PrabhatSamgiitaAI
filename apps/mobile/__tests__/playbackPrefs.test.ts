import { describe, expect, it } from "vitest"

import {
  DEFAULT_LIST_TRANSITION_SECONDS,
  DEFAULT_RADIO_TRANSITION_SECONDS,
  MAX_TRACK_RATES,
  clampTransitionSeconds,
  isRadioRunning,
  sanitizeTrackRates,
  startRateFor,
  trackKeyOf,
  transitionSecondsFor,
  withTrackRate,
} from "@/lib/playerV2/playbackPrefs"
import { pitchChoiceFor, pitchEnumValue } from "@/lib/playback/pitchAlgorithm"
import { SPEED_MAX, SPEED_MIN, clampRate, formatRateSign, isPresetRate, stepRate } from "@/lib/playerV2/playbackSpeed"
import { SLEEP_PRESET_MINUTES, sleepFade, sleepVerdict, sleepWaitsForTrack, startSleepEndOfList, startSleepEndOfSong } from "@/lib/playerV2/sleepTimer"

describe("smooth transitions settings", () => {
  it("0 to 6 seconds in half-second steps; bad values fall back", () => {
    expect(clampTransitionSeconds(-3)).toBe(0)
    expect(clampTransitionSeconds(9)).toBe(6)
    expect(clampTransitionSeconds(2.3)).toBe(2.5)
    expect(clampTransitionSeconds("x", 2)).toBe(2)
    expect(clampTransitionSeconds(undefined, 0)).toBe(0)
  })

  it("on in the radio by default, off in lists", () => {
    expect(DEFAULT_RADIO_TRANSITION_SECONDS).toBeGreaterThan(0)
    expect(DEFAULT_LIST_TRANSITION_SECONDS).toBe(0)
  })

  it("the radio value applies only while the radio runs", () => {
    const v = { radioSeconds: 2, listSeconds: 4 }
    expect(transitionSecondsFor({ radio: true, ...v })).toBe(2)
    expect(transitionSecondsFor({ radio: false, ...v })).toBe(4)
    expect(isRadioRunning({ playbackMode: "random", driveAutoAdvance: true })).toBe(true)
    expect(isRadioRunning({ playbackMode: "random", driveAutoAdvance: false })).toBe(false)
    expect(isRadioRunning({ playbackMode: "default", driveAutoAdvance: true })).toBe(false)
  })
})

describe("speed", () => {
  it("runs from 0.5x to 2x in 0.05 steps", () => {
    expect([SPEED_MIN, SPEED_MAX]).toEqual([0.5, 2])
    expect(stepRate(1, 0.05)).toBe(1.05)
    expect(stepRate(1.97, 0.05)).toBe(2)
    expect(stepRate(2, 0.05)).toBe(2)
    expect(stepRate(0.5, -0.05)).toBe(0.5)
    expect(stepRate(1.02, 0.05)).toBe(1.05)
    expect(clampRate(2.5)).toBe(2)
    expect(formatRateSign(1.05)).toBe("1.05×")
    expect(isPresetRate(1.25)).toBe(true)
    expect(isPresetRate(1.05)).toBe(false)
  })

  it("a recording starts at its own speed, else the default", () => {
    const rates = withTrackRate({}, "ps:12", 1.5, 100)
    expect(startRateFor({ key: "ps:12", rates, defaultRate: 1 })).toBe(1.5)
    expect(startRateFor({ key: "ps:13", rates, defaultRate: 1.25 })).toBe(1.25)
    expect(startRateFor({ key: "ps:12", rates: withTrackRate(rates, "ps:12", null, 200), defaultRate: 1 })).toBe(1)
  })

  it("keys tell a catalogue song from an uploaded recording", () => {
    expect(trackKeyOf({ number: 7 })).toBe("ps:7")
    expect(trackKeyOf({ number: 900001, kind: "kiirtan", kiirtan: { id: "abc" } })).toBe("rec:abc")
  })

  it("only the newest speeds are kept; damaged storage is dropped", () => {
    let rates = {}
    for (let i = 0; i < MAX_TRACK_RATES + 5; i += 1) rates = withTrackRate(rates, `ps:${i}`, 1.25, i)
    expect(Object.keys(rates)).toHaveLength(MAX_TRACK_RATES)
    expect(Object.keys(rates)).not.toContain("ps:0")
    expect(sanitizeTrackRates({ a: { rate: "x" }, b: { rate: 9, at: 1 }, c: null })).toEqual({ b: { rate: 2, at: 1 } })
    expect(sanitizeTrackRates("junk")).toEqual({})
  })
})

describe("pitch", () => {
  it("keeps the pitch by default: music for songs, voice for talks; linear when the pitch follows the speed", () => {
    expect(pitchChoiceFor({ keepPitch: true, cls: "music" })).toBe("music")
    expect(pitchChoiceFor({ keepPitch: true, cls: "speech" })).toBe("voice")
    expect(pitchChoiceFor({ keepPitch: false, cls: "music" })).toBe("linear")
  })

  it("maps to the player's enum only when it exists", () => {
    const enumLike = { PitchAlgorithm: { Linear: 1, Music: 2, Voice: 3 } }
    expect(pitchEnumValue(enumLike, "music")).toBe(2)
    expect(pitchEnumValue(enumLike, "linear")).toBe(1)
    expect(pitchEnumValue({}, "music")).toBeUndefined()
    expect(pitchEnumValue(undefined, "voice")).toBeUndefined()
  })
})

describe("sleep timer presets and end of playlist", () => {
  it("offers 5, 10, 15, 30, 45 and 60 minutes", () => {
    expect([...SLEEP_PRESET_MINUTES]).toEqual([5, 10, 15, 30, 45, 60])
  })

  it("end of playlist waits only for the last track; earlier tracks play on", () => {
    const timer = startSleepEndOfList(30)
    expect(sleepWaitsForTrack(timer, 10)).toBe(false)
    expect(sleepWaitsForTrack(timer, 30)).toBe(true)
    expect(sleepWaitsForTrack(startSleepEndOfSong(10), 10)).toBe(true)
    const early = { now: 0, songNumber: 10, position: 199.9, duration: 200 }
    expect(sleepVerdict(timer, early)).toBe("keep-going")
    expect(sleepVerdict(timer, { ...early, songNumber: 30 })).toBe("pause")
  })

  it("fades only in the last seconds of the waited-for track", () => {
    const timer = startSleepEndOfList(30)
    expect(sleepFade(timer, { now: 0, songNumber: 10, position: 195, duration: 200 })).toBe(1)
    const f = sleepFade(timer, { now: 0, songNumber: 30, position: 195, duration: 200 })
    expect(f).toBeGreaterThan(0)
    expect(f).toBeLessThan(1)
  })
})
