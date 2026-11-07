import type { HistoryEntry } from "@/lib/listening/history"
import {
  effectiveSelection,
  radioCategoryOf,
  type RadioCategory,
} from "@/lib/radio/categories"
import { newMixState, pickNext, type MixPick, type MixState } from "@/lib/radio/mix"
import { buildRadioPools, psNumberOfKey, recordingIdOfKey, type PoolSource, type RadioPools } from "@/lib/radio/pool"

/**
 * The Radio's "what plays next", end to end: pool -> selection -> mixer -> a queue number. Everything outside the mixer
 * comes in through `deps`, so a test runs a whole session with fake stores. `lib/radio/live.ts` wires the real ones.
 */

export type PickerDeps = {
  /** the person's chosen categories (may include stale ones; `effectiveSelection` sorts that out) */
  selected: () => readonly RadioCategory[]
  source: () => PoolSource
  /** this phone's listening history (newest first) */
  history: () => readonly HistoryEntry[]
  now: () => number
  /** the queue number of a recording (registers it with the player so the number can be turned back into a track) */
  recordingNumber: (recordingId: string) => number
}

export type RadioPicker = {
  /** Next queue number. `exclude` (the track playing now) is never returned while anything else can play. */
  next: (exclude: number) => number | null
  /** The pools as of now (the chips show their counts). */
  pools: () => RadioPools
  /** The category of the last pick (the prefetched track): used to drop it when the selection no longer allows it. */
  lastPick: () => { key: string; category: RadioCategory; number: number } | null
  /** Start a fresh session (new seed, empty memory of the picks). */
  reset: (seed?: number) => void
  state: () => MixState
}

/** key -> ms of the last counted listen, from the history. */
export function heardMap(history: readonly HistoryEntry[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of history) {
    const prev = out.get(e.itemKey)
    if (prev == null || e.at > prev) out.set(e.itemKey, e.at)
  }
  return out
}

export function createRadioPicker(deps: PickerDeps, seed = deps.now()): RadioPicker {
  let state = newMixState(seed)
  let last: { key: string; category: RadioCategory; number: number } | null = null
  const numberOf = (key: string): number | null => {
    const ps = psNumberOfKey(key)
    if (ps != null) return ps
    const id = recordingIdOfKey(key)
    return id != null ? deps.recordingNumber(id) : null
  }
  const poolsNow = () => buildRadioPools(deps.source())

  const next = (exclude: number): number | null => {
    const built = poolsNow()
    const chosen = effectiveSelection(deps.selected(), built.counts)
    const pools = built.pools.filter((p) => chosen.includes(p.category as RadioCategory) && p.keys.length)
    if (!pools.length) return null
    const heard = heardMap(deps.history())
    let pick: MixPick | null = null
    // The track playing now is not a pick of this session when the person started it by hand; skip it if it comes up.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = pickNext({ pools, meta: built.meta, heard, now: deps.now() }, state)
      state = result.state
      pick = result.pick
      if (!pick) return null
      if (numberOf(pick.key) !== exclude) break
    }
    if (!pick) return null
    const number = numberOf(pick.key)
    if (number == null) return null
    last = { key: pick.key, category: pick.category as RadioCategory, number }
    return number
  }

  return {
    next,
    pools: poolsNow,
    lastPick: () => last,
    reset: (s = deps.now()) => {
      state = newMixState(s)
      last = null
    },
    state: () => state,
  }
}

/** The category of a stored kind id, for callers that hold a track and want its chip. */
export const categoryOfKind = radioCategoryOf
