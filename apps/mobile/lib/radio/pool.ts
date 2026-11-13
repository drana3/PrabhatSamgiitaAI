import { PS_SONG_COUNT, type Kirtan } from "@/lib/kirtan/types"
import { RADIO_CATEGORIES, radioCategoryOf, type RadioCategory, type RadioCounts } from "@/lib/radio/categories"
import type { CategoryPool, TrackMeta } from "@/lib/radio/mix"

/**
 * The candidates of the Radio: every playable track, sorted into the six categories. Pure (the catalogue comes in as
 * arguments). A track's key is the one the listening history and the play counter already use: `ps:<number>` for a
 * catalogue song, `rec:<app id>` for a recording (lib/listening/capture.ts).
 */

export type RadioPools = {
  /** one per category, in chip order, empty ones included (the chips show their count 0) */
  pools: CategoryPool[]
  counts: RadioCounts
  meta: (key: string) => TrackMeta
  /** the recording behind a `rec:` key */
  recording: (key: string) => Kirtan | undefined
}

export type PoolSource = {
  /** every catalogue song number that has a known audio file */
  psNumbers: readonly number[]
  /** published recordings that can play */
  recordings: readonly Kirtan[]
  /** counted plays (all time) by key: `ps:<n>` and `rec:<server id>` (lib/radio/popularity.ts) */
  plays?: ReadonlyMap<string, number>
}

export const psKey = (n: number) => `ps:${n}`
export const recKey = (id: string) => `rec:${id}`

/** The catalogue number behind a `ps:` key; null for any other key. */
export function psNumberOfKey(key: string): number | null {
  if (!key.startsWith("ps:")) return null
  const n = Number(key.slice(3))
  return Number.isInteger(n) && n >= 1 && n <= PS_SONG_COUNT ? n : null
}

export function recordingIdOfKey(key: string): string | null {
  return key.startsWith("rec:") ? key.slice(4) : null
}

export function buildRadioPools(source: PoolSource): RadioPools {
  const keys: Record<RadioCategory, string[]> = {
    prabhat_samgiita: [],
    kiirtan: [],
    bhajan: [],
    spiritual_song: [],
    dance_song: [],
    baba_audio: [],
    other_mantra: [],
  }
  for (const n of source.psNumbers) keys.prabhat_samgiita.push(psKey(n))
  const byKey = new Map<string, Kirtan>()
  for (const k of source.recordings) {
    const category = radioCategoryOf(k.kind) ?? "kiirtan"
    const key = recKey(k.id)
    if (byKey.has(key)) continue
    byKey.set(key, k)
    keys[category].push(key)
  }
  const pools = RADIO_CATEGORIES.map((category) => ({ category, keys: keys[category] }))
  const counts = Object.fromEntries(pools.map((p) => [p.category, p.keys.length])) as RadioCounts
  const plays = source.plays
  const meta = (key: string): TrackMeta => {
    const k = byKey.get(key)
    // The server counts a recording by its server id; a preview recording has only its app id.
    const counted = (k?.serverId ? plays?.get(recKey(k.serverId)) : undefined) ?? plays?.get(key)
    return { performer: k?.author ?? null, plays: counted ?? null }
  }
  return { pools, counts, meta, recording: (key) => byKey.get(key) }
}
