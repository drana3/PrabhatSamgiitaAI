/**
 * Radio mix: which track plays next when the Radio runs on one or more categories. Pure: no React, no stores, no I/O,
 * no clock of its own and no `Math.random` (every random choice comes from a seed, so a test can replay a session).
 * The mechanism, the numbers and the reasons are written for people in docs/radio-mixing.md; this file is the code of it.
 *
 * Steps of one pick:
 *   1. POOL      the tracks of the selected categories (the caller builds them, lib/radio/pool.ts)
 *   2. QUOTAS    which category is next: smooth weighted round-robin over damped, floored and capped category weights
 *   3. BAG       which track of that category: a seeded shuffle bag (every track once per cycle, popular ones twice)
 *   4. ANTI-REPEAT  not in the last picks, not heard in the last hour, not the same performer as the one before
 *   5. BOOST     already inside step 3 (extra copy in the bag), bounded to two copies
 */

/** Every number of the mix, in one place. The document quotes these values. */
export const MIX_RULES = {
  /** Never repeat a track inside the last N picks (smaller for a small pool: see `recentWindowFor`). */
  recentWindow: 20,
  /** A track heard in the last hour (per this phone's listening history) is skipped while there is another. */
  heardMs: 60 * 60 * 1000,
  /** Older listens only nudge: a track heard `tau` ago is as "stale" as a fresh one is 1/e times. */
  historyTauMs: 6 * 60 * 60 * 1000,
  /** Among the next few bag entries that pass the rules, the one heard longest ago wins. */
  scanAhead: 12,
  /** How far down the bag the rules look for a track that passes before they are relaxed. */
  scanMax: 64,
  /** Category size is damped by this power before it becomes a share: 0.5 = square root. */
  categoryPower: 0.5,
  /** Every selected category gets at least this fraction of an equal share (0.5 of 1/k). */
  categoryFloor: 0.5,
  /** ... but never more than size / this many picks (a category of 3 tracks is not played every 4th pick). */
  categoryCapPicks: 40,
  /** Extra tickets a track at full popularity gets in the bag: 1 means at most 2 copies in a cycle. */
  boostMax: 1,
  /** Counted plays under this count as no signal at all (noise, one person looping). */
  boostMinPlays: 5,
  /** Counted plays at which the boost is full; more adds nothing. */
  boostRefPlays: 200,
} as const

export type TrackMeta = {
  /** performer text; empty or missing = unknown, which never blocks a track */
  performer?: string | null
  /** counted plays from the server (all time), when known */
  plays?: number | null
}

/** The candidates of one selected category. Keys are stable ids ("ps:123", "rec:<id>"). */
export type CategoryPool = { category: string; keys: readonly string[] }

export type MixInput = {
  /** only the SELECTED categories; an empty pool is ignored */
  pools: readonly CategoryPool[]
  meta: (key: string) => TrackMeta
  /** key -> ms since epoch of the last counted listen (the local listening history); absent = never */
  heard?: ReadonlyMap<string, number>
  now: number
}

export type MixState = {
  seed: number
  /** how many random streams were used: the next stream is (seed, counter), so a replay repeats exactly */
  counter: number
  /** category -> the tracks still to come in this cycle, in order */
  bags: Readonly<Record<string, readonly string[]>>
  /** category -> a cheap signature of the pool the bag was made from */
  signatures: Readonly<Record<string, string>>
  /** category -> how many cycles were made so far */
  cycles: Readonly<Record<string, number>>
  /** weighted round-robin credit per category */
  credit: Readonly<Record<string, number>>
  /** the last picks, newest first, at most `recentWindow` */
  recent: readonly string[]
  lastPerformer: string | null
  picked: number
}

export type Relaxed = "performer" | "heard" | "recent"

export type MixPick = {
  key: string
  category: string
  /** rules that had to be given up because nothing else was left (empty = every rule held) */
  relaxed: readonly Relaxed[]
  /** a new cycle of the category began with this pick */
  cycleStarted: boolean
  /** the selection is so small that a track had to come back sooner than the rules want */
  exhausted: boolean
}

export function newMixState(seed: number): MixState {
  return {
    seed: seed >>> 0,
    counter: 0,
    bags: {},
    signatures: {},
    cycles: {},
    credit: {},
    recent: [],
    lastPerformer: null,
    picked: 0,
  }
}

// ---- seeded random ----------------------------------------------------------------------------------------------

/** mulberry32: a tiny, well-spread generator. The same seed gives the same numbers on every device. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function streamFor(seed: number, counter: number): () => number {
  return mulberry32((seed ^ Math.imul(counter + 1, 0x9e3779b1)) >>> 0)
}

/** Fisher-Yates, in place. */
function shuffleInPlace<T>(list: T[], rng: () => number): void {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const swap = list[i] as T
    list[i] = list[j] as T
    list[j] = swap
  }
}

// ---- popularity -------------------------------------------------------------------------------------------------

/**
 * How popular a track is, 0..1, from its counted plays. Three safeguards against one loud number:
 * a gate (under `boostMinPlays` it is 0), a logarithm (ten times the plays is not ten times the score) and a ceiling
 * (`boostRefPlays` and above is 1). A viral song and a well-loved one differ little in the end.
 */
export function popularityScore(plays: number | null | undefined, rules = MIX_RULES): number {
  const p = typeof plays === "number" && Number.isFinite(plays) ? plays : 0
  if (p < rules.boostMinPlays) return 0
  const top = Math.log(1 + (rules.boostRefPlays - rules.boostMinPlays))
  if (top <= 0) return 0
  return Math.min(1, Math.max(0, Math.log(1 + (p - rules.boostMinPlays)) / top))
}

/** Tickets of a track in its category's bag: 1 for an unknown track, up to `1 + boostMax` for the most played. */
export function boostWeight(plays: number | null | undefined, rules = MIX_RULES): number {
  return 1 + rules.boostMax * popularityScore(plays, rules)
}

// ---- category weights -------------------------------------------------------------------------------------------

/**
 * Each category's share of the picks (sums to 1). Size is damped (square root), then bounded: not under `floor` of an
 * equal share, so a handful of Baba's discourses is not drowned by thousands of songs, and not over size/capPicks, so a
 * tiny category is not hammered. The caps are dropped when they cannot add up to everything (very few tracks overall).
 */
export function categoryWeights(pools: readonly CategoryPool[], rules = MIX_RULES): Record<string, number> {
  const live = pools.filter((p) => p.keys.length > 0)
  const k = live.length
  const out: Record<string, number> = {}
  if (!k) return out
  if (k === 1) return { [(live[0] as CategoryPool).category]: 1 }
  const raw = live.map((p) => Math.pow(p.keys.length, rules.categoryPower))
  const caps = live.map((p) => Math.min(1, p.keys.length / rules.categoryCapPicks))
  const capSum = caps.reduce((a, b) => a + b, 0)
  const lows = live.map((_, i) => Math.min((rules.categoryFloor / k) as number, caps[i] as number))
  // Bounded proportional allocation: fix whoever hits a bound, share the rest by raw weight, repeat.
  const useCaps = capSum >= 1
  const lo = lows
  const hi = live.map((_, i) => (useCaps ? (caps[i] as number) : 1))
  const share = new Array<number>(k).fill(0)
  const fixed = new Array<boolean>(k).fill(false)
  for (let round = 0; round <= k; round += 1) {
    const freeIdx = live.map((_, i) => i).filter((i) => !fixed[i])
    const fixedMass = share.reduce((a, s, i) => a + (fixed[i] ? s : 0), 0)
    const rawSum = freeIdx.reduce((a, i) => a + (raw[i] as number), 0)
    const mass = 1 - fixedMass
    if (!freeIdx.length || rawSum <= 0) break
    let changed = false
    for (const i of freeIdx) {
      const want = (mass * (raw[i] as number)) / rawSum
      if (want < (lo[i] as number)) {
        share[i] = lo[i] as number
        fixed[i] = true
        changed = true
      } else if (want > (hi[i] as number)) {
        share[i] = hi[i] as number
        fixed[i] = true
        changed = true
      } else {
        share[i] = want
      }
    }
    if (!changed) break
  }
  const total = share.reduce((a, b) => a + b, 0) || 1
  live.forEach((p, i) => {
    out[p.category] = (share[i] as number) / total
  })
  return out
}

// ---- the bag ----------------------------------------------------------------------------------------------------

function signatureOf(keys: readonly string[]): string {
  return `${keys.length}|${keys[0] ?? ""}|${keys[keys.length - 1] ?? ""}`
}

/** One cycle for a category: every track once, popular tracks twice, shuffled, copies of one track kept apart. */
export function buildBag(
  keys: readonly string[],
  meta: (key: string) => TrackMeta,
  rng: () => number,
  rules = MIX_RULES,
): string[] {
  const list: string[] = []
  for (const key of keys) {
    list.push(key)
    const extra = boostWeight(meta(key).plays, rules) - 1
    if (extra > 0 && rng() < extra) list.push(key)
  }
  shuffleInPlace(list, rng)
  // Keep the two copies of one track apart: a copy that sits within `gap` of its twin moves to the first later place
  // where it has no twin close by.
  const gap = Math.max(1, Math.min(rules.recentWindow, Math.floor(keys.length / 2)))
  for (let i = 0; i < list.length; i += 1) {
    const key = list[i] as string
    const near = list.slice(Math.max(0, i - gap), i)
    if (!near.includes(key)) continue
    for (let j = i + 1; j < list.length; j += 1) {
      const candidate = list[j] as string
      if (candidate === key) continue
      const before = list.slice(Math.max(0, i - gap), i)
      if (!before.includes(candidate)) {
        list[i] = candidate
        list[j] = key
        break
      }
    }
  }
  return list
}

/** The window of "do not repeat" for a category of this size (a category of 3 tracks cannot keep 20 apart). */
export function recentWindowFor(size: number, rules = MIX_RULES): number {
  return Math.max(0, Math.min(rules.recentWindow, Math.floor(size / 2)))
}

const norm = (value: string | null | undefined): string | null => {
  const v = (value ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  return v ? v : null
}

/** 0 for a track never heard, up to 1 for one heard just now; the older the listen the nearer 0. */
export function staleness(lastHeard: number | undefined, now: number, rules = MIX_RULES): number {
  if (lastHeard == null) return 0
  return Math.exp(-Math.max(0, now - lastHeard) / rules.historyTauMs)
}

// ---- one pick ---------------------------------------------------------------------------------------------------

type Found = { index: number; key: string; relaxed: Relaxed[] }

function findInBag(
  bag: readonly string[],
  recentBlocked: ReadonlySet<string>,
  lastKey: string | null,
  lastPerformer: string | null,
  input: MixInput,
  rules: typeof MIX_RULES,
): Found | null {
  const limit = Math.min(bag.length, rules.scanMax)
  // Each level gives one more rule up, in this order: performer, then the hour, then the recent window.
  const levels: { performer: boolean; heard: boolean; recent: "window" | "last" | "none"; relaxed: Relaxed[] }[] = [
    { performer: true, heard: true, recent: "window", relaxed: [] },
    { performer: false, heard: true, recent: "window", relaxed: ["performer"] },
    { performer: false, heard: false, recent: "window", relaxed: ["performer", "heard"] },
    { performer: false, heard: false, recent: "last", relaxed: ["performer", "heard", "recent"] },
    { performer: false, heard: false, recent: "none", relaxed: ["performer", "heard", "recent"] },
  ]
  for (const level of levels) {
    const eligible: { index: number; key: string; stale: number }[] = []
    for (let i = 0; i < limit && eligible.length < rules.scanAhead; i += 1) {
      const key = bag[i] as string
      if (level.recent === "window" && recentBlocked.has(key)) continue
      if (level.recent === "last" && key === lastKey) continue
      const last = input.heard?.get(key)
      if (level.heard && last != null && input.now - last < rules.heardMs) continue
      if (level.performer && lastPerformer !== null && norm(input.meta(key).performer) === lastPerformer) continue
      eligible.push({ index: i, key, stale: staleness(last, input.now, rules) })
    }
    if (!eligible.length) continue
    // the earliest in the bag among the least stale; the bag order stays the main order
    let best = eligible[0] as (typeof eligible)[number]
    for (const e of eligible) if (e.stale < best.stale - 1e-9) best = e
    return { index: best.index, key: best.key, relaxed: [...level.relaxed] }
  }
  return null
}

/**
 * The next track. Returns the pick and the new state (the old one is not touched). `null` only when the selected pools
 * hold no track at all. The same input and state always give the same answer.
 */
export function pickNext(input: MixInput, state: MixState, rules = MIX_RULES): { pick: MixPick | null; state: MixState } {
  const pools = input.pools.filter((p) => p.keys.length > 0)
  if (!pools.length) return { pick: null, state }
  const weights = categoryWeights(pools, rules)
  const total = pools.reduce((a, p) => a + p.keys.length, 0)
  const credit: Record<string, number> = { ...state.credit }
  const bags: Record<string, readonly string[]> = { ...state.bags }
  const signatures: Record<string, string> = { ...state.signatures }
  const cycles: Record<string, number> = { ...state.cycles }
  let counter = state.counter

  // Smooth weighted round-robin: every active category earns its weight, the richest is tried first and pays the sum.
  const active = pools.map((p) => p.category)
  for (const c of Object.keys(credit)) if (!active.includes(c)) delete credit[c]
  for (const c of active) credit[c] = (credit[c] ?? 0) + (weights[c] ?? 0)
  const order = [...active].sort((a, b) => (credit[b] ?? 0) - (credit[a] ?? 0) || active.indexOf(a) - active.indexOf(b))

  const lastKey = state.recent[0] ?? null
  for (const category of order) {
    const pool = pools.find((p) => p.category === category) as CategoryPool
    const sig = signatureOf(pool.keys)
    let bag = bags[category] ?? []
    let cycleStarted = false
    if (signatures[category] !== sig && bag.length) {
      const live = new Set(pool.keys)
      bag = bag.filter((k) => live.has(k))
    }
    signatures[category] = sig
    if (!bag.length) {
      bag = buildBag(pool.keys, input.meta, streamFor(state.seed, counter), rules)
      counter += 1
      cycles[category] = (cycles[category] ?? 0) + 1
      cycleStarted = true
    }
    const window = recentWindowFor(pool.keys.length, rules)
    const recentBlocked = new Set(state.recent.slice(0, window))
    const found = findInBag(bag, recentBlocked, lastKey, state.lastPerformer, input, rules)
    if (!found) continue
    const rest = bag.slice()
    rest.splice(found.index, 1)
    bags[category] = rest
    // a track that was bought twice in this cycle is gone from the bag once; its second copy is still in `rest`
    credit[category] = (credit[category] ?? 0) - active.reduce((a, c) => a + (weights[c] ?? 0), 0)
    const meta = input.meta(found.key)
    const next: MixState = {
      seed: state.seed,
      counter,
      bags,
      signatures,
      cycles,
      credit,
      recent: [found.key, ...state.recent].slice(0, rules.recentWindow),
      lastPerformer: norm(meta.performer),
      picked: state.picked + 1,
    }
    return {
      pick: {
        key: found.key,
        category,
        relaxed: found.relaxed,
        cycleStarted,
        exhausted: found.relaxed.includes("recent") || total <= 1,
      },
      state: next,
    }
  }
  return { pick: null, state }
}
