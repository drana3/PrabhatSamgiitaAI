import { describe, expect, it } from "vitest"

import { flushPlays } from "@/lib/authors/flush"
import {
  MAX_EVENTS_PER_BATCH,
  MAX_QUEUED_EVENTS,
  PlayTracker,
  enqueue,
  fresh,
  newDeviceId,
  playThreshold,
  qualifies,
  recordingIdOfTrack,
  takeBatch,
  type Sample,
} from "@/lib/authors/plays"
import type { PlayEventOut } from "@/lib/authors/types"
import { NetworkError, RemoteError } from "@/lib/kirtan/remote"

const T0 = Date.parse("2026-11-01T10:00:00Z")

function run(samples: Sample[]): PlayEventOut[] {
  const out: PlayEventOut[] = []
  const tracker = new PlayTracker((e) => out.push(e))
  for (const s of samples) tracker.feed(s)
  return out
}

/** Listening in one-second steps from `from` to `to` seconds of the track. */
function listen(id: string, from: number, to: number, startAt: number, duration: number | null = 600): Sample[] {
  const samples: Sample[] = []
  for (let p = from; p <= to; p += 1) {
    samples.push({ recordingId: id, playing: true, position: p, duration, at: startAt + (p - from) * 1000 })
  }
  return samples
}

describe("play threshold (the server's rule)", () => {
  it("is 30 seconds, or half of a short track, never under 10", () => {
    expect(playThreshold(600)).toBe(30)
    expect(playThreshold(null)).toBe(30)
    expect(playThreshold(0)).toBe(30)
    expect(playThreshold(40)).toBe(20)
    expect(playThreshold(20)).toBe(10)
    expect(playThreshold(4)).toBe(10)
    expect(qualifies(29, 600)).toBe(false)
    expect(qualifies(30, 600)).toBe(true)
  })
})

describe("PlayTracker", () => {
  it("sends one event after 30 seconds of a long track, and only one", () => {
    const events = run(listen("r1", 0, 90, T0))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ recording_id: "r1", duration_sec: 600 })
    expect(events[0]!.listened_sec).toBeGreaterThanOrEqual(30)
    expect(events[0]!.played_at).toBe(new Date(T0).toISOString())
  })

  it("sends nothing for 20 seconds", () => {
    expect(run(listen("r1", 0, 20, T0))).toHaveLength(0)
  })

  it("does not count a seek as listening", () => {
    const samples = [...listen("r1", 0, 5, T0), { recordingId: "r1", playing: true, position: 400, duration: 600, at: T0 + 6000 }]
    expect(run(samples)).toHaveLength(0)
  })

  it("does not count paused time", () => {
    const samples: Sample[] = []
    for (let i = 0; i < 100; i += 1) samples.push({ recordingId: "r1", playing: false, position: 3, duration: 600, at: T0 + i * 1000 })
    expect(run(samples)).toHaveLength(0)
  })

  it("counts a short track after half of it", () => {
    const events = run(listen("short", 0, 12, T0, 20))
    expect(events).toHaveLength(1)
    expect(events[0]!.duration_sec).toBe(20)
  })

  it("ignores what is not a recording (a song, nothing)", () => {
    const samples = listen("x", 0, 90, T0).map((s) => ({ ...s, recordingId: null }))
    expect(run(samples)).toHaveLength(0)
  })

  it("starts a new listen when the track changes", () => {
    const events = run([...listen("a", 0, 20, T0), ...listen("b", 0, 40, T0 + 21_000)])
    expect(events.map((e) => e.recording_id)).toEqual(["b"])
  })

  it("does not send the same recording twice on the same day on this phone", () => {
    const first = listen("a", 0, 40, T0)
    const again = listen("a", 0, 40, T0 + 120_000)
    expect(run([...first, ...again])).toHaveLength(1)
  })

  it("sends it again the next day", () => {
    const events = run([...listen("a", 0, 40, T0), ...listen("a", 0, 40, T0 + 26 * 3600_000)])
    expect(events).toHaveLength(2)
  })
})

describe("the waiting line", () => {
  const event = (n: number, at = T0): PlayEventOut => ({
    recording_id: `r${n}`,
    played_at: new Date(at).toISOString(),
    listened_sec: 40,
    duration_sec: 300,
  })

  it("keeps at most MAX_QUEUED_EVENTS, dropping the oldest", () => {
    let q: PlayEventOut[] = []
    for (let i = 0; i < MAX_QUEUED_EVENTS + 5; i += 1) q = enqueue(q, event(i))
    expect(q).toHaveLength(MAX_QUEUED_EVENTS)
    expect(q[0]!.recording_id).toBe("r5")
  })

  it("drops events the server would refuse as stale", () => {
    const now = T0 + 10 * 86_400_000
    const q = [event(1, T0), event(2, now - 3600_000)]
    expect(fresh(q, now).map((e) => e.recording_id)).toEqual(["r2"])
  })

  it("splits a batch at the server's limit", () => {
    const q = Array.from({ length: MAX_EVENTS_PER_BATCH + 3 }, (_, i) => event(i))
    const { batch, rest } = takeBatch(q)
    expect(batch).toHaveLength(MAX_EVENTS_PER_BATCH)
    expect(rest).toHaveLength(3)
  })

  it("makes a 32-hex device id from the random source it is given", () => {
    expect(newDeviceId(() => 0)).toBe("0".repeat(32))
    expect(newDeviceId()).toMatch(/^[0-9a-f]{32}$/)
  })

  it("maps a player track to a server recording id", () => {
    expect(recordingIdOfTrack({ kind: "kiirtan", kiirtan: { id: "srv-abc" } }, () => undefined)).toBe("abc")
    expect(recordingIdOfTrack({ kind: "kiirtan", kiirtan: { id: "local-1" } }, (id) => (id === "local-1" ? "zzz" : undefined))).toBe("zzz")
    expect(recordingIdOfTrack({ kind: "kiirtan", kiirtan: { id: "local-2" } }, () => undefined)).toBeNull()
    expect(recordingIdOfTrack({ kind: "song" }, () => undefined)).toBeNull()
    expect(recordingIdOfTrack(null, () => undefined)).toBeNull()
  })
})

describe("flushPlays", () => {
  const batch: PlayEventOut[] = [{ recording_id: "r", played_at: new Date(T0).toISOString(), listened_sec: 40, duration_sec: 300 }]
  const ok = { accepted: 1, duplicates: 0, rejected: {} }

  function deps(send: () => Promise<typeof ok>) {
    const done: number[] = []
    return { done, d: { next: () => batch, done: (n: number) => done.push(n), send } }
  }

  it("does nothing when the line is empty", async () => {
    expect(await flushPlays({ next: () => [], done: () => undefined, send: async () => ok })).toBe("empty")
  })

  it("removes the batch after a success", async () => {
    const { d, done } = deps(async () => ok)
    expect(await flushPlays(d)).toBe("sent")
    expect(done).toEqual([1])
  })

  it("keeps the batch when there is no network, a 5xx or a 429", async () => {
    for (const fail of [new NetworkError(), new RemoteError(503, "x"), new RemoteError(429, "x"), new RemoteError(408, "x")]) {
      const { d, done } = deps(async () => {
        throw fail
      })
      expect(await flushPlays(d)).toBe("kept")
      expect(done).toEqual([])
    }
  })

  it("drops a batch the server will never take (4xx), so the line cannot get stuck", async () => {
    const { d, done } = deps(async () => {
      throw new RemoteError(422, "bad")
    })
    expect(await flushPlays(d)).toBe("dropped")
    expect(done).toEqual([1])
  })
})
