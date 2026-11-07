import { popularityFromRows, setPopularity } from "@/lib/radio/popularity"
import type { TopPlayedApi } from "@/lib/topPlayed/types"

/**
 * Fills the Radio's popularity map (lib/radio/popularity.ts) from the server's all-time Top Played list: up to three pages
 * of 100, the most played first. Runs at most once in ten minutes and never blocks or fails the Radio: if the server cannot
 * be reached the map stays as it was (empty = no signal, so the mix is a plain shuffle). Only counts leave the server;
 * nothing about this listener is sent.
 */
const PAGES = 3
const PAGE_SIZE = 100
export const POPULARITY_TTL_MS = 10 * 60 * 1000

let loadedAt = 0
let inflight: Promise<void> | null = null

export function loadPopularity(api: TopPlayedApi, now: number = Date.now()): Promise<void> {
  if (inflight) return inflight
  if (loadedAt && now - loadedAt < POPULARITY_TTL_MS) return Promise.resolve()
  inflight = (async () => {
    const rows: { ref: "ps" | "rec"; id: string; plays: number }[] = []
    try {
      for (let page = 0; page < PAGES; page += 1) {
        const result = await api.fetch({ period: "all", kinds: [], limit: PAGE_SIZE, offset: page * PAGE_SIZE })
        for (const item of result.items) rows.push({ ref: item.ref, id: item.id, plays: item.plays })
        if (!result.hasMore) break
      }
      if (rows.length) {
        setPopularity(popularityFromRows(rows))
        loadedAt = now
      }
    } catch {
      /* no signal this time: the Radio shuffles plainly */
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** For tests. */
export function resetPopularityLoad(): void {
  loadedAt = 0
  inflight = null
}
