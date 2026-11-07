import { describe, expect, it } from "vitest"

import {
  MIX_RULES,
  boostWeight,
  buildBag,
  categoryWeights,
  mulberry32,
  newMixState,
  pickNext,
  popularityScore,
  recentWindowFor,
  staleness,
  type CategoryPool,
  type MixInput,
  type MixState,
  type TrackMeta,
} from "@/lib/radio/mix"

const range = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}:${i + 1}`)
const NOW = Date.UTC(2026, 10, 7, 12, 0, 0)

type Options = { meta?: (key: string) => TrackMeta; heard?: Map<string, number> }
function run(pools: CategoryPool[], picks: number, seed = 1, opts: Options = {}, start?: MixState) {
  let state = start ?? newMixState(seed)
  const input: MixInput = { pools, meta: opts.meta ?? (() => ({})), heard: opts.heard, now: NOW }
  const out: { key: string; category: string; relaxed: readonly string[]; exhausted: boolean }[] = []
  for (let i = 0; i < picks; i += 1) {
    const step = pickNext(input, state)
    if (!step.pick) break
    out.push({ key: step.pick.key, category: step.pick.category, relaxed: step.pick.relaxed, exhausted: step.pick.exhausted })
    state = step.state
  }
  return { out, state }
}

const BIG: CategoryPool[] = [
  { category: "prabhat_samgiita", keys: range(3700, "ps") },
  { category: "kiirtan", keys: range(120, "k") },
  { category: "bhajan", keys: range(40, "b") },
  { category: "baba_audio", keys: range(3, "ba") },
]

describe("seeded random", () => {
  it("gives the same numbers for the same seed and different numbers for another", () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    const c = mulberry32(8)
    const first = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(first)
    expect([c(), c(), c()]).not.toEqual(first)
    for (const n of first) expect(n >= 0 && n < 1).toBe(true)
  })
})

describe("pickNext: determinism", () => {
  it("replays a session exactly from the same seed", () => {
    const a = run(BIG, 60, 42).out.map((p) => p.key)
    const b = run(BIG, 60, 42).out.map((p) => p.key)
    expect(a).toEqual(b)
  })
  it("another seed gives another order", () => {
    expect(run(BIG, 40, 1).out.map((p) => p.key)).not.toEqual(run(BIG, 40, 2).out.map((p) => p.key))
  })
  it("does not change the state it was given", () => {
    const start = newMixState(5)
    const frozen = JSON.stringify(start)
    run(BIG, 5, 5, {}, start)
    expect(JSON.stringify(start)).toBe(frozen)
  })
  it("can stop and carry on: 30 picks then 30 more equal 60 in a row", () => {
    const whole = run(BIG, 60, 9).out.map((p) => p.key)
    const half = run(BIG, 30, 9)
    const rest = run(BIG, 30, 9, {}, half.state)
    expect([...half.out, ...rest.out].map((p) => p.key)).toEqual(whole)
  })
})

describe("pickNext: no repeat inside the memory window", () => {
  it("a single category of 100 keeps every track 20 picks apart", () => {
    const pool = [{ category: "kiirtan", keys: range(100, "k") }]
    const keys = run(pool, 600, 3).out.map((p) => p.key)
    expect(keys).toHaveLength(600)
    const last = new Map<string, number>()
    keys.forEach((key, i) => {
      const prev = last.get(key)
      if (prev != null) expect(i - prev, `${key} came back after ${i - prev}`).toBeGreaterThan(MIX_RULES.recentWindow)
      last.set(key, i)
    })
  })

  it("holds across several categories at once", () => {
    const pools = [
      { category: "kiirtan", keys: range(60, "k") },
      { category: "bhajan", keys: range(60, "b") },
      { category: "prabhat_samgiita", keys: range(300, "ps") },
    ]
    const keys = run(pools, 900, 11).out.map((p) => p.key)
    const last = new Map<string, number>()
    keys.forEach((key, i) => {
      const prev = last.get(key)
      if (prev != null) expect(i - prev).toBeGreaterThan(MIX_RULES.recentWindow)
      last.set(key, i)
    })
  })

  it("a small category keeps half its size apart", () => {
    expect(recentWindowFor(3)).toBe(1)
    expect(recentWindowFor(10)).toBe(5)
    expect(recentWindowFor(1000)).toBe(MIX_RULES.recentWindow)
    expect(recentWindowFor(1)).toBe(0)
  })

  it("never plays the same track twice in a row while there are two tracks", () => {
    const keys = run([{ category: "kiirtan", keys: ["k:1", "k:2"] }], 40, 4).out.map((p) => p.key)
    for (let i = 1; i < keys.length; i += 1) expect(keys[i]).not.toBe(keys[i - 1])
  })
})

describe("pickNext: the shuffle bag", () => {
  it("plays every track once before any comes back (no popularity yet)", () => {
    const pool = [{ category: "kiirtan", keys: range(50, "k") }]
    const keys = run(pool, 50, 8).out.map((p) => p.key)
    expect(new Set(keys).size).toBe(50)
    const second = run(pool, 100, 8).out.map((p) => p.key).slice(50)
    expect(new Set(second).size).toBe(50)
  })
  it("the cold start is a plain shuffle: no boost, equal copies", () => {
    const bag = buildBag(range(200, "k"), () => ({}), mulberry32(1))
    expect(bag).toHaveLength(200)
    expect(new Set(bag).size).toBe(200)
  })
  it("a bag is a different order for another seed", () => {
    const keys = range(30, "k")
    expect(buildBag(keys, () => ({}), mulberry32(1))).not.toEqual(buildBag(keys, () => ({}), mulberry32(2)))
  })
})

describe("pickNext: every selected category is heard, in fair shares", () => {
  it("each of four very different categories appears inside the first 40 picks", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const first = run(BIG, 40, seed).out
      for (const c of ["prabhat_samgiita", "kiirtan", "bhajan", "baba_audio"]) {
        expect(first.some((p) => p.category === c), `${c} missing with seed ${seed}`).toBe(true)
      }
    }
  })

  it("the shares follow the weights within one percent over 2000 picks", () => {
    const weights = categoryWeights(BIG)
    const { out } = run(BIG, 2000, 6)
    for (const c of Object.keys(weights)) {
      const share = out.filter((p) => p.category === c).length / out.length
      expect(Math.abs(share - (weights[c] as number)), `${c}: ${share} vs ${weights[c]}`).toBeLessThan(0.01)
    }
  })

  it("weights sum to one, damp size, floor the small and cap the tiny", () => {
    const w = categoryWeights(BIG)
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9)
    // 3700 songs are not 95% of the picks: damped (square root) they are about two thirds at most
    expect(w.prabhat_samgiita as number).toBeLessThan(0.75)
    expect(w.prabhat_samgiita as number).toBeGreaterThan(w.kiirtan as number)
    // the floor: no category under half an equal share (1/8) unless its cap is lower
    expect(w.bhajan as number).toBeGreaterThanOrEqual(0.5 / 4 - 1e-9)
    // the cap: 3 discourses are at most 3/40 of the picks
    expect(w.baba_audio as number).toBeLessThanOrEqual(3 / MIX_RULES.categoryCapPicks + 1e-9)
    expect(w.baba_audio as number).toBeGreaterThan(0.04)
  })

  it("one category gets everything; empty categories are ignored", () => {
    expect(categoryWeights([{ category: "kiirtan", keys: ["k:1"] }])).toEqual({ kiirtan: 1 })
    const w = categoryWeights([
      { category: "kiirtan", keys: range(5, "k") },
      { category: "bhajan", keys: [] },
    ])
    expect(w).toEqual({ kiirtan: 1 })
    expect(categoryWeights([])).toEqual({})
  })

  it("with very few tracks overall the caps give way so the weights still add up", () => {
    const w = categoryWeights([
      { category: "kiirtan", keys: ["k:1", "k:2"] },
      { category: "bhajan", keys: ["b:1"] },
    ])
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9)
    expect(w.kiirtan as number).toBeGreaterThan(w.bhajan as number)
  })

  it("removing a category from the selection stops it at once and keeps the others playing", () => {
    const first = run(BIG, 30, 21)
    const smaller = BIG.filter((p) => p.category !== "kiirtan")
    const after = run(smaller, 80, 21, {}, first.state).out
    expect(after.some((p) => p.category === "kiirtan")).toBe(false)
    expect(after.length).toBe(80)
  })

  it("adding a category brings it in within a few picks", () => {
    const only = BIG.filter((p) => p.category === "prabhat_samgiita")
    const first = run(only, 10, 22)
    const after = run(BIG, 25, 22, {}, first.state).out
    expect(after.some((p) => p.category === "baba_audio")).toBe(true)
    expect(after.some((p) => p.category === "kiirtan")).toBe(true)
  })
})

describe("popularity boost", () => {
  it("scores 0 under the gate, rises with the logarithm and stops at the ceiling", () => {
    expect(popularityScore(undefined)).toBe(0)
    expect(popularityScore(MIX_RULES.boostMinPlays - 1)).toBe(0)
    expect(popularityScore(MIX_RULES.boostMinPlays)).toBe(0)
    const a = popularityScore(20)
    const b = popularityScore(100)
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(a)
    expect(popularityScore(MIX_RULES.boostRefPlays)).toBeCloseTo(1, 9)
    expect(popularityScore(10_000_000)).toBe(1)
    // ten times the plays is far from ten times the score
    expect(popularityScore(2000) / popularityScore(200)).toBeLessThanOrEqual(1)
    expect(popularityScore(100) / popularityScore(20)).toBeLessThan(2)
  })

  it("is bounded: the ticket weight never leaves 1..1+boostMax", () => {
    for (const plays of [0, 1, 4, 5, 6, 50, 200, 1e6, Number.NaN, -3]) {
      const w = boostWeight(plays)
      expect(w).toBeGreaterThanOrEqual(1)
      expect(w).toBeLessThanOrEqual(1 + MIX_RULES.boostMax)
    }
  })

  it("gives a very popular track at most two places per cycle and the rest one", () => {
    const keys = range(100, "k")
    const meta = (key: string): TrackMeta => ({ plays: key === "k:7" ? 1_000_000 : 0 })
    for (let seed = 1; seed <= 20; seed += 1) {
      const bag = buildBag(keys, meta, mulberry32(seed))
      expect(bag.filter((k) => k === "k:7")).toHaveLength(2)
      expect(bag.filter((k) => k === "k:8")).toHaveLength(1)
      expect(bag).toHaveLength(101)
    }
  })

  it("plays the popular track about twice as often as an unknown one, never more", () => {
    const pool = [{ category: "kiirtan", keys: range(60, "k") }]
    const meta = (key: string): TrackMeta => ({ plays: key === "k:1" ? 500 : 0 })
    const { out } = run(pool, 61 * 40, 31, { meta })
    const count = (key: string) => out.filter((p) => p.key === key).length
    const average = out.length / 60
    expect(count("k:1")).toBeGreaterThan(average * 1.5)
    expect(count("k:1")).toBeLessThanOrEqual(average * (1 + MIX_RULES.boostMax) * 1.05)
    expect(count("k:2")).toBeLessThanOrEqual(average * 1.2)
  })

  it("a track with a few plays is not pushed at all (the gate) and a middling one only a little", () => {
    const keys = range(100, "k")
    const copies = (plays: number) => {
      let total = 0
      for (let seed = 1; seed <= 200; seed += 1) {
        total += buildBag(keys, (k) => ({ plays: k === "k:3" ? plays : 0 }), mulberry32(seed)).filter((k) => k === "k:3").length
      }
      return total / 200
    }
    expect(copies(3)).toBe(1)
    const middle = copies(30)
    expect(middle).toBeGreaterThan(1.2)
    expect(middle).toBeLessThan(1.8)
  })

  it("keeps the two copies of one track apart in the bag", () => {
    const keys = range(40, "k")
    const meta = () => ({ plays: 100_000 })
    const bag = buildBag(keys, meta, mulberry32(5))
    const gap = Math.floor(keys.length / 2)
    const seen = new Map<string, number>()
    bag.forEach((k, i) => {
      const prev = seen.get(k)
      if (prev != null) expect(i - prev).toBeGreaterThan(Math.min(gap, 3))
      seen.set(k, i)
    })
  })

  it("the boost never starves anyone: every track still plays in every cycle", () => {
    const pool = [{ category: "kiirtan", keys: range(30, "k") }]
    const meta = (key: string): TrackMeta => ({ plays: key === "k:1" ? 9999 : 0 })
    const { out } = run(pool, 31 * 3, 12, { meta })
    for (const key of range(30, "k")) expect(out.filter((p) => p.key === key).length).toBeGreaterThanOrEqual(2)
  })
})

describe("anti-repeat: the person's own listening history", () => {
  it("skips tracks heard in the last hour while others are left", () => {
    const keys = range(40, "k")
    const heard = new Map<string, number>(keys.slice(0, 30).map((k) => [k, NOW - 10 * 60 * 1000]))
    const { out } = run([{ category: "kiirtan", keys }], 10, 3, { heard })
    for (const p of out) expect(heard.has(p.key), p.key).toBe(false)
  })

  it("still plays when everything was heard in the last hour, and says it gave that rule up", () => {
    const keys = range(6, "k")
    const heard = new Map<string, number>(keys.map((k) => [k, NOW - 5 * 60 * 1000]))
    const { out } = run([{ category: "kiirtan", keys }], 12, 3, { heard })
    expect(out).toHaveLength(12)
    expect(out.every((p) => p.relaxed.includes("heard"))).toBe(true)
  })

  it("an old listen does not block, it only lets a fresher track go first", () => {
    const keys = ["k:1", "k:2", "k:3"]
    const heard = new Map([["k:1", NOW - 5 * 3600 * 1000]])
    expect(staleness(heard.get("k:1"), NOW)).toBeGreaterThan(0.3)
    expect(staleness(undefined, NOW)).toBe(0)
    expect(staleness(NOW, NOW)).toBe(1)
    const first = run([{ category: "kiirtan", keys }], 3, 2, { heard }).out.map((p) => p.key)
    expect(new Set(first).size).toBe(3)
    expect(first[0]).not.toBe("k:1")
  })
})

describe("anti-repeat: the same performer back to back", () => {
  const performers = ["Ananda", "Bhakti", "Chitra"]
  const keys = range(60, "k")
  const meta = (key: string): TrackMeta => ({ performer: performers[Number(key.split(":")[1]) % 3] })

  it("avoids it whenever another performer is on offer: a repeat only happens flagged, and rarely", () => {
    for (const seed of [1, 2, 3]) {
      const { out } = run([{ category: "kiirtan", keys }], 240, seed, { meta })
      let repeats = 0
      for (let i = 1; i < out.length; i += 1) {
        const same = meta((out[i] as { key: string }).key).performer === meta((out[i - 1] as { key: string }).key).performer
        if (same) {
          repeats += 1
          expect((out[i] as { relaxed: readonly string[] }).relaxed).toContain("performer")
        }
      }
      // only the tail of a cycle can leave nothing but one performer
      expect(repeats / out.length).toBeLessThan(0.1)
    }
  })

  it("a category with one performer still plays (the rule gives way)", () => {
    const { out } = run([{ category: "kiirtan", keys: range(30, "k") }], 40, 1, { meta: () => ({ performer: "Same" }) })
    expect(out).toHaveLength(40)
    expect(out.some((p) => p.relaxed.includes("performer"))).toBe(true)
  })

  it("ignores spacing and case, and never blocks an unknown performer", () => {
    const m = (key: string): TrackMeta => ({ performer: key === "k:1" ? " Ananda  " : key === "k:2" ? "ANANDA" : "" })
    const { out } = run([{ category: "kiirtan", keys: ["k:1", "k:2", "k:3", "k:4"] }], 60, 5, { meta: m })
    for (let i = 1; i < out.length; i += 1) {
      const a = (out[i - 1] as { key: string }).key
      const b = out[i] as { key: string; relaxed: readonly string[] }
      if ((a === "k:1" && b.key === "k:2") || (a === "k:2" && b.key === "k:1")) expect(b.relaxed).toContain("performer")
    }
    // the unknown performers (empty text) are never held back by the rule
    expect(out.filter((p) => p.key === "k:3" || p.key === "k:4").every((p) => !p.relaxed.includes("performer"))).toBe(true)
  })
})

describe("exhaustion and edges", () => {
  it("an empty selection gives nothing and leaves the state alone", () => {
    const state = newMixState(1)
    const step = pickNext({ pools: [], meta: () => ({}), now: NOW }, state)
    expect(step.pick).toBeNull()
    expect(step.state).toBe(state)
    expect(pickNext({ pools: [{ category: "kiirtan", keys: [] }], meta: () => ({}), now: NOW }, state).pick).toBeNull()
  })

  it("a pool of three goes round and round in balance with no immediate repeat", () => {
    const keys = ["k:1", "k:2", "k:3"]
    const { out } = run([{ category: "kiirtan", keys }], 30, 1)
    expect(out).toHaveLength(30)
    for (let i = 1; i < out.length; i += 1) expect((out[i] as { key: string }).key).not.toBe((out[i - 1] as { key: string }).key)
    for (const key of keys) expect(out.filter((p) => p.key === key).length).toBe(10)
  })

  it("a pool of one repeats that track and says the selection is exhausted", () => {
    const { out } = run([{ category: "kiirtan", keys: ["k:1"] }], 5, 1)
    expect(out.map((p) => p.key)).toEqual(["k:1", "k:1", "k:1", "k:1", "k:1"])
    expect(out.every((p) => p.exhausted)).toBe(true)
  })

  it("flags a new cycle only when one begins", () => {
    let state = newMixState(1)
    const input: MixInput = { pools: [{ category: "kiirtan", keys: range(4, "k") }], meta: () => ({}), now: NOW }
    const starts: boolean[] = []
    for (let i = 0; i < 9; i += 1) {
      const step = pickNext(input, state)
      starts.push((step.pick as { cycleStarted: boolean }).cycleStarted)
      state = step.state
    }
    expect(starts).toEqual([true, false, false, false, true, false, false, false, true])
  })

  it("is not slow with the whole catalogue (3700 + a few hundred tracks, 200 picks)", () => {
    const t0 = Date.now()
    run(BIG, 200, 1)
    expect(Date.now() - t0).toBeLessThan(2000)
  })

  it("a track that left the pool is never picked from an old bag", () => {
    const first = run([{ category: "kiirtan", keys: range(30, "k") }], 5, 2)
    const shrunk = [{ category: "kiirtan", keys: range(30, "k").slice(0, 10) }]
    const after = run(shrunk, 20, 2, {}, first.state).out
    for (const p of after) expect(Number(p.key.split(":")[1])).toBeLessThanOrEqual(10)
  })
})
