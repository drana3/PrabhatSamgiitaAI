import { describe, expect, it } from "vitest"

import type { HistoryEntry } from "@/lib/listening/history"
import type { Kirtan, RecordingKind } from "@/lib/kirtan/types"
import type { RadioCategory } from "@/lib/radio/categories"
import { createRadioPicker, heardMap, type PickerDeps } from "@/lib/radio/picker"
import { buildRadioPools, psNumberOfKey, recKey, recordingIdOfKey } from "@/lib/radio/pool"
import { popularityFromRows } from "@/lib/radio/popularity"

const NOW = Date.UTC(2026, 10, 7, 12, 0, 0)

function rec(id: string, kind: RecordingKind | "devotional_song", author = `Author ${id}`, serverId?: string): Kirtan {
  return {
    id,
    kind: kind as RecordingKind,
    title: `T ${id}`,
    author,
    durationSec: 300,
    type: "kiirtan" as Kirtan["type"],
    audioUrl: "https://x/y.mp3",
    thumbnailUrl: null,
    addedBy: "x",
    status: "published",
    addedAt: 1,
    serverId,
  } as Kirtan
}

function world(over: Partial<{ ps: number; counts: Partial<Record<RecordingKind, number>>; selected: RadioCategory[]; history: HistoryEntry[] }> = {}) {
  const psNumbers = Array.from({ length: over.ps ?? 300 }, (_, i) => i + 1)
  const recordings: Kirtan[] = []
  const per: Record<string, number> = { kiirtan: 30, bhajan: 12, spiritual_song: 8, dance_song: 0, baba_audio: 3, ...over.counts }
  for (const [kind, n] of Object.entries(per)) {
    for (let i = 0; i < n; i += 1) recordings.push(rec(`${kind}-${i}`, kind as RecordingKind, `${kind} performer ${i % 7}`))
  }
  const state = { selected: over.selected ?? (["prabhat_samgiita"] as RadioCategory[]), history: over.history ?? [], now: NOW }
  const numbers = new Map<string, number>()
  const deps: PickerDeps = {
    selected: () => state.selected,
    source: () => ({ psNumbers, recordings }),
    history: () => state.history,
    now: () => state.now,
    recordingNumber: (id) => {
      if (!numbers.has(id)) numbers.set(id, 1_000_000_000 + numbers.size)
      return numbers.get(id) as number
    },
  }
  const kindOfNumber = (n: number): string => {
    if (n < 1_000_000_000) return "prabhat_samgiita"
    const id = [...numbers.entries()].find(([, v]) => v === n)?.[0] as string
    return id.replace(/-\d+$/, "")
  }
  return { deps, state, kindOfNumber }
}

function run(w: ReturnType<typeof world>, seed: number, picks: number) {
  const picker = createRadioPicker(w.deps, seed)
  const out: number[] = []
  let current = 0
  for (let i = 0; i < picks; i += 1) {
    const n = picker.next(current)
    if (n == null) break
    out.push(n)
    current = n
  }
  return { picker, out }
}

describe("pool and keys", () => {
  it("sorts tracks into the seven categories and counts them, empty ones too", () => {
    const w = world()
    const built = buildRadioPools(w.deps.source())
    expect(built.pools.map((p) => p.category)).toEqual([
      "prabhat_samgiita",
      "kiirtan",
      "bhajan",
      "spiritual_song",
      "dance_song",
      "other_mantra",
      "baba_audio",
    ])
    expect(built.counts).toEqual({
      prabhat_samgiita: 300,
      kiirtan: 30,
      bhajan: 12,
      spiritual_song: 8,
      dance_song: 0,
      other_mantra: 0,
      baba_audio: 3,
    })
  })

  it("files an uploaded Prabhat Samgiita performance under Prabhat Samgiita and a legacy devotional_song under Bhajan", () => {
    const built = buildRadioPools({
      psNumbers: [1, 2],
      recordings: [rec("a", "prabhat_samgiita"), rec("b", "devotional_song")],
    })
    expect(built.counts.prabhat_samgiita).toBe(3)
    expect(built.counts.bhajan).toBe(1)
  })

  it("reads keys back", () => {
    expect(psNumberOfKey("ps:12")).toBe(12)
    expect(psNumberOfKey("ps:0")).toBeNull()
    expect(psNumberOfKey("ps:9999")).toBeNull()
    expect(psNumberOfKey("rec:ps:3")).toBeNull()
    expect(recordingIdOfKey("rec:srv-1")).toBe("srv-1")
    expect(recordingIdOfKey("ps:1")).toBeNull()
  })

  it("finds popularity by server id first, then by app id", () => {
    const plays = popularityFromRows([
      { ref: "rec", id: "uuid-1", plays: 40 },
      { ref: "rec", id: "local-2", plays: 9 },
      { ref: "ps", id: "5", plays: 100 },
      { ref: "ps", id: "6", plays: 0 },
    ])
    const built = buildRadioPools({
      psNumbers: [5, 6],
      recordings: [rec("srv-uuid-1", "kiirtan", "A", "uuid-1"), rec("local-2", "kiirtan", "B")],
      plays,
    })
    expect(built.meta(recKey("srv-uuid-1")).plays).toBe(40)
    expect(built.meta(recKey("local-2")).plays).toBe(9)
    expect(built.meta("ps:5").plays).toBe(100)
    expect(built.meta("ps:6").plays).toBeNull()
  })
})

describe("radio picker", () => {
  it("with Prabhat Samgiita chosen, every pick is a catalogue song", () => {
    const w = world()
    const { out } = run(w, 1, 200)
    expect(out.every((n) => n >= 1 && n <= 300)).toBe(true)
  })

  it("picks only from the chosen categories", () => {
    const w = world({ selected: ["kiirtan", "baba_audio"] })
    const { out } = run(w, 2, 120)
    const kinds = new Set(out.map(w.kindOfNumber))
    expect([...kinds].sort()).toEqual(["baba_audio", "kiirtan"])
  })

  it("every chosen category is heard", () => {
    const w = world({ selected: ["prabhat_samgiita", "kiirtan", "bhajan", "spiritual_song", "baba_audio"] })
    const { out } = run(w, 3, 150)
    const kinds = new Set(out.map(w.kindOfNumber))
    expect(kinds.size).toBe(5)
  })

  it("is deterministic for one seed and differs between seeds", () => {
    const a = run(world({ selected: ["prabhat_samgiita", "kiirtan"] }), 77, 60).out
    const b = run(world({ selected: ["prabhat_samgiita", "kiirtan"] }), 77, 60).out
    const c = run(world({ selected: ["prabhat_samgiita", "kiirtan"] }), 78, 60).out
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it("never returns the track playing now", () => {
    const w = world({ selected: ["baba_audio"] })
    const picker = createRadioPicker(w.deps, 5)
    let current = 0
    for (let i = 0; i < 60; i += 1) {
      const n = picker.next(current)
      expect(n).not.toBe(current)
      current = n as number
    }
  })

  it("a change of choice takes effect from the next pick, with no restart", () => {
    const w = world({ selected: ["prabhat_samgiita"] })
    const picker = createRadioPicker(w.deps, 9)
    let current = 0
    const before: number[] = []
    for (let i = 0; i < 20; i += 1) {
      current = picker.next(current) as number
      before.push(current)
    }
    expect(before.every((n) => n < 1_000_000_000)).toBe(true)
    w.state.selected = ["baba_audio"]
    const after: number[] = []
    for (let i = 0; i < 20; i += 1) {
      current = picker.next(current) as number
      after.push(current)
    }
    expect(after.every((n) => w.kindOfNumber(n) === "baba_audio")).toBe(true)
    w.state.selected = ["prabhat_samgiita", "baba_audio"]
    const mixed = Array.from({ length: 60 }, () => (current = picker.next(current) as number))
    expect(new Set(mixed.map(w.kindOfNumber))).toEqual(new Set(["prabhat_samgiita", "baba_audio"]))
  })

  it("a stale choice (the only chosen category emptied) falls back instead of going silent", () => {
    const w = world({ selected: ["dance_song"] })
    const { out } = run(w, 4, 10)
    expect(out).toHaveLength(10)
    // the fallback is the default, which is every category that has tracks (it used to be Prabhat Samgiita only)
    expect(out.every((n) => n > 0)).toBe(true)
  })

  it("returns null when nothing at all can play", () => {
    const deps: PickerDeps = { ...world().deps, source: () => ({ psNumbers: [], recordings: [] }) }
    expect(createRadioPicker(deps, 1).next(0)).toBeNull()
  })

  it("avoids tracks heard in the last hour while others exist", () => {
    const heardKeys = Array.from({ length: 100 }, (_, i) => i + 1)
    const history: HistoryEntry[] = heardKeys.map((n) => ({
      id: `ps:${n}@d`,
      itemKey: `ps:${n}`,
      ref: "ps",
      itemId: String(n),
      title: "t",
      kind: "prabhat_samgiita",
      at: NOW - 10 * 60 * 1000,
    }))
    const w = world({ history })
    const { out } = run(w, 6, 15)
    // 200 of 300 songs were not heard in the last hour: the first 15 picks come from them
    expect(out.every((n) => n > 100)).toBe(true)
  })

  it("heardMap keeps the latest listen of a track", () => {
    const m = heardMap([
      { id: "a", itemKey: "ps:1", ref: "ps", itemId: "1", title: "", kind: "x", at: 5 },
      { id: "b", itemKey: "ps:1", ref: "ps", itemId: "1", title: "", kind: "x", at: 9 },
    ])
    expect(m.get("ps:1")).toBe(9)
  })

  it("reports the last pick's category (so a prefetched track can be dropped on a change)", () => {
    const w = world({ selected: ["kiirtan"] })
    const picker = createRadioPicker(w.deps, 2)
    expect(picker.lastPick()).toBeNull()
    const n = picker.next(0) as number
    expect(picker.lastPick()).toMatchObject({ category: "kiirtan", number: n })
    picker.reset(3)
    expect(picker.lastPick()).toBeNull()
  })
})
