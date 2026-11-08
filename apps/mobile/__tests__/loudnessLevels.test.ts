import { describe, expect, it } from "vitest"

import {
  ATTENUATION_ONLY_DROP_DB,
  MAX_BOOST_DB,
  MAX_CUT_DB,
  TARGET_LUFS,
  TRUE_PEAK_CEILING_DB,
  computeLevel,
  dbToGain,
  gainToDb,
  isUsableInfo,
  loudnessAfter,
  referenceLufs,
} from "@/lib/loudness/levels"
import { levelForSong, loudnessClassOf, loudnessInfoFrom, songLoudness } from "@/lib/loudness/songLevel"

const music = (lufs: number, truePeakDb: number | null = -3) => ({ lufs, truePeakDb })

describe("dB and gain", () => {
  it("converts both ways", () => {
    expect(dbToGain(0)).toBe(1)
    expect(dbToGain(-6)).toBeCloseTo(0.5012, 3)
    expect(dbToGain(20)).toBeCloseTo(10, 6)
    expect(gainToDb(0.5)).toBeCloseTo(-6.0206, 3)
    expect(gainToDb(0)).toBe(-Infinity)
  })
})

describe("references", () => {
  it("music -14, speech -16 for a player that can boost", () => {
    expect(referenceLufs("music", true)).toBe(-14)
    expect(referenceLufs("speech", true)).toBe(-16)
    expect(TARGET_LUFS.music - TARGET_LUFS.speech).toBe(2)
  })
  it("is lowered by 4 dB when the player can only turn down", () => {
    expect(referenceLufs("music", false)).toBe(-14 - ATTENUATION_ONLY_DROP_DB)
    expect(referenceLufs("speech", false)).toBe(-16 - ATTENUATION_ONLY_DROP_DB)
  })
})

describe("computeLevel on a player that can only turn down (the phone)", () => {
  const phone = { enabled: true, cls: "music" as const, canBoost: false }

  it("turns a loud track down to the reference, exactly", () => {
    const r = computeLevel({ ...phone, info: music(-9) })
    expect(r.reason).toBe("matched")
    expect(r.gainDb).toBe(-9) // -9 -> -18
    expect(loudnessAfter(music(-9), r.gainDb)).toBe(-18)
    expect(r.gain).toBeCloseTo(dbToGain(-9), 6)
  })

  it("leaves a quiet track alone and says how far short it stays", () => {
    const r = computeLevel({ ...phone, info: music(-22) })
    expect(r.gainDb).toBe(0)
    expect(r.gain).toBe(1)
    expect(r.reason).toBe("cannot-boost")
    expect(r.shortfallDb).toBe(4)
  })

  it("a track exactly on the reference stays untouched and counts as matched", () => {
    const r = computeLevel({ ...phone, info: music(-18) })
    expect(r.gainDb).toBe(0)
    expect(r.reason).toBe("matched")
  })

  it("never gives a gain above 1", () => {
    for (let lufs = -69; lufs <= 0; lufs += 1.5) {
      expect(computeLevel({ ...phone, info: music(lufs) }).gain).toBeLessThanOrEqual(1)
    }
  })

  it("two recordings 8 dB apart end up within 0.1 dB of each other when both are above the reference", () => {
    const a = computeLevel({ ...phone, info: music(-8) })
    const b = computeLevel({ ...phone, info: music(-16) })
    // -8 -> -18 and -16 -> -18 (both turned down), so the join is level
    expect(loudnessAfter(music(-8), a.gainDb)).toBe(loudnessAfter(music(-16), b.gainDb))
  })
})

describe("computeLevel on a player that can boost (Web Audio)", () => {
  const web = { enabled: true, cls: "music" as const, canBoost: true }

  it("raises a quiet track to -14 when the peak leaves room", () => {
    const r = computeLevel({ ...web, info: music(-20, -9) })
    expect(r.reason).toBe("boosted")
    expect(r.gainDb).toBe(6)
    expect(loudnessAfter(music(-20, -9), r.gainDb)).toBe(-14)
  })

  it("stops the boost at the true-peak ceiling (-1 dBTP)", () => {
    // wants +6, the peak is at -3 dBTP: only 2 dB of room
    const r = computeLevel({ ...web, info: music(-20, -3) })
    expect(r.reason).toBe("peak-limited")
    expect(r.gainDb).toBe(2)
    expect(r.shortfallDb).toBe(4)
    expect(-3 + r.gainDb).toBeLessThanOrEqual(TRUE_PEAK_CEILING_DB + 1e-9)
  })

  it("Spotify's own example: -20 LUFS with a -5 dBFS peak is raised to -16 only", () => {
    const r = computeLevel({ ...web, info: music(-20, -5) })
    expect(r.gainDb).toBe(4)
    expect(loudnessAfter(music(-20, -5), r.gainDb)).toBe(-16)
  })

  it("does not boost when the peak is not known or already above the ceiling", () => {
    expect(computeLevel({ ...web, info: music(-20, null) }).gainDb).toBe(0)
    expect(computeLevel({ ...web, info: music(-20, 0.5) }).gainDb).toBe(0)
  })

  it("never boosts by more than the limit and never cuts by more than the limit", () => {
    expect(computeLevel({ ...web, info: music(-60, -40) }).gainDb).toBe(MAX_BOOST_DB)
    expect(computeLevel({ ...web, info: music(-1, 0) }).gainDb).toBe(-13)
    expect(computeLevel({ enabled: true, cls: "music", canBoost: false, info: music(-0.1, 0) }).gainDb).toBeGreaterThanOrEqual(-MAX_CUT_DB)
  })
})

describe("speech and music", () => {
  it("speech goes 2 dB lower than music at the same measured loudness", () => {
    const base = { enabled: true, canBoost: true, info: music(-10) }
    const m = computeLevel({ ...base, cls: "music" })
    const s = computeLevel({ ...base, cls: "speech" })
    expect(m.gainDb).toBe(-4)
    expect(s.gainDb).toBe(-6)
    expect(m.gainDb - s.gainDb).toBe(2)
  })
})

describe("nothing to level", () => {
  const info = music(-9)
  it("is neutral when the switch is off", () => {
    const r = computeLevel({ enabled: false, info, cls: "music", canBoost: false })
    expect(r).toMatchObject({ gainDb: 0, gain: 1, reason: "off", referenceLufs: null })
  })
  it("is neutral when the track is not measured", () => {
    expect(computeLevel({ enabled: true, info: null, cls: "music", canBoost: false }).reason).toBe("unmeasured")
  })
  it("treats silence and broken numbers as unmeasured", () => {
    for (const bad of [music(-70), music(-80), music(Number.NaN), music(Infinity), music(3), music(-12, Number.NaN)]) {
      expect(isUsableInfo(bad)).toBe(false)
      expect(computeLevel({ enabled: true, info: bad, cls: "music", canBoost: true }).gainDb).toBe(0)
    }
    expect(isUsableInfo(music(-12, null))).toBe(true)
  })
})

describe("song helpers", () => {
  it("reads the two API fields, null when the loudness is missing", () => {
    expect(loudnessInfoFrom({ loudnessLufs: -13.2, truePeakDb: -1.4 })).toEqual({ lufs: -13.2, truePeakDb: -1.4 })
    expect(loudnessInfoFrom({ loudnessLufs: -13.2, truePeakDb: null })).toEqual({ lufs: -13.2, truePeakDb: null })
    expect(loudnessInfoFrom({ loudnessLufs: null })).toBeNull()
    expect(loudnessInfoFrom(undefined)).toBeNull()
  })
  it("classes Baba's audio discourses as speech and everything else as music", () => {
    expect(loudnessClassOf({ kiirtan: { id: "x", type: "t", addedBy: "", recording: "baba_audio" } })).toBe("speech")
    expect(loudnessClassOf({ kiirtan: { id: "x", type: "t", addedBy: "", recording: "kiirtan" } })).toBe("music")
    expect(loudnessClassOf({})).toBe("music")
    expect(loudnessClassOf(null)).toBe("music")
  })
  it("levels a song from its stored numbers", () => {
    const song = { loudness: { lufs: -10, truePeakDb: -2 } }
    expect(songLoudness(song)).toEqual({ lufs: -10, truePeakDb: -2 })
    expect(levelForSong(song, { enabled: true, canBoost: false }).gainDb).toBe(-8)
    expect(levelForSong({}, { enabled: true, canBoost: false }).reason).toBe("unmeasured")
  })
})
