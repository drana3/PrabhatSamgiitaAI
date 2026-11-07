import { describe, expect, it } from "vitest"

import { PlayTracker, songNumberOfTrack, type Sample } from "@/lib/authors/plays"
import type { PlayEventOut } from "@/lib/authors/types"

const T0 = Date.parse("2026-11-07T10:00:00Z")

function run(samples: Sample[]): PlayEventOut[] {
  const out: PlayEventOut[] = []
  const tracker = new PlayTracker((e) => out.push(e))
  for (const s of samples) tracker.feed(s)
  return out
}

/** A listener who hears `seconds` of a track in one-second steps. */
function listen(base: Omit<Sample, "position" | "at" | "playing">, seconds: number, startAt = T0): Sample[] {
  return Array.from({ length: seconds + 1 }, (_, i) => ({ ...base, playing: true, position: i, at: startAt + i * 1000 }))
}

describe("counted plays of a Prabhat Samgiita song", () => {
  it("a song heard for 30 seconds becomes ONE event with song_number and no recording_id", () => {
    const events = run(listen({ recordingId: null, songNumber: 42, duration: 240 }, 31))
    expect(events).toHaveLength(1)
    expect(events[0].song_number).toBe(42)
    expect(events[0].recording_id).toBeUndefined()
    expect(events[0].listened_sec).toBeGreaterThanOrEqual(30)
    expect(events[0].duration_sec).toBe(240)
  })

  it("counts nothing under the threshold", () => {
    expect(run(listen({ recordingId: null, songNumber: 42, duration: 240 }, 20))).toEqual([])
  })

  it("a short track needs half of it (never under 10 seconds)", () => {
    expect(run(listen({ recordingId: null, songNumber: 7, duration: 40 }, 21))).toHaveLength(1)
    expect(run(listen({ recordingId: null, songNumber: 7, duration: 40 }, 15))).toEqual([])
  })

  it("one event per song per day on this phone", () => {
    const first = listen({ recordingId: null, songNumber: 42, duration: 240 }, 35)
    const again = listen({ recordingId: null, songNumber: 42, duration: 240 }, 35, T0 + 600_000)
    expect(run([...first, ...again])).toHaveLength(1)
  })

  it("two different songs are two events", () => {
    const a = listen({ recordingId: null, songNumber: 1, duration: 240 }, 35)
    const b = listen({ recordingId: null, songNumber: 2, duration: 240 }, 35, T0 + 600_000)
    expect(run([...a, ...b]).map((e) => e.song_number)).toEqual([1, 2])
  })

  it("a recording still reports recording_id (unchanged)", () => {
    const events = run(listen({ recordingId: "abc", duration: 240 }, 35))
    expect(events).toHaveLength(1)
    expect(events[0].recording_id).toBe("abc")
    expect(events[0].song_number).toBeUndefined()
  })

  it("when a recording id is given the song number is ignored", () => {
    const events = run(listen({ recordingId: "abc", songNumber: 5, duration: 240 }, 35))
    expect(events[0].recording_id).toBe("abc")
    expect(events[0].song_number).toBeUndefined()
  })

  it("a local-history key in the recording field keeps working as before", () => {
    const events = run(listen({ recordingId: "ps:12", duration: 240 }, 35))
    expect(events[0].recording_id).toBe("ps:12")
  })

  it("seeking forward does not count as listening", () => {
    const samples: Sample[] = [
      { recordingId: null, songNumber: 3, playing: true, position: 0, duration: 300, at: T0 },
      { recordingId: null, songNumber: 3, playing: true, position: 120, duration: 300, at: T0 + 1000 },
      { recordingId: null, songNumber: 3, playing: true, position: 121, duration: 300, at: T0 + 2000 },
    ]
    expect(run(samples)).toEqual([])
  })
})

describe("songNumberOfTrack", () => {
  it("reads a catalogue song and nothing else", () => {
    expect(songNumberOfTrack({ kind: "song", number: 12 })).toBe(12)
    expect(songNumberOfTrack({ number: 5018 })).toBe(5018)
    expect(songNumberOfTrack({ number: 5019 })).toBeNull()
    expect(songNumberOfTrack({ number: 0 })).toBeNull()
    expect(songNumberOfTrack({ kind: "kiirtan", number: 1_000_000_007 })).toBeNull()
    expect(songNumberOfTrack(null)).toBeNull()
  })
})
