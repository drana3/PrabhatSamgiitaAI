import { visibleTop, type TopKind } from "@/lib/topPlayed/model"
import type { TopItem, TopPeriod, TopPlayedApi, TopQuery } from "@/lib/topPlayed/types"

/**
 * The "Most played" shelf on Today (Dada, 10 Nov 2026, variant B1): the top of the last 7 days from the same server list
 * as the Top played screen, five rows, a chip per kind. Places 1 to 5 show on the shelf, the counts only on the full
 * screen. The shelf stays hidden until there are at least five rows, so a young app shows no hole and no "5 plays" row.
 * Pure: the network comes in as `api`, the clock as `now`.
 */

export const SHELF_MIN = 5
/** Asked for a few more than shown, so a blocked author's recording does not leave the shelf short. */
export const SHELF_FETCH = 8
export const SHELF_PERIOD: TopPeriod = "7d"
/** The chips, as the board shows them: All, Prabhat Samgiita, Kiirtan, Bhajan. */
export const SHELF_KINDS: readonly TopKind[] = ["all", "prabhat_samgiita", "kiirtan", "bhajan"]
/** The server caches the list for five minutes; so does the phone. */
export const SHELF_TTL_MS = 5 * 60 * 1000

export function shelfQuery(kind: TopKind): TopQuery {
  return { period: SHELF_PERIOD, kinds: kind === "all" ? [] : [kind], limit: SHELF_FETCH, offset: 0 }
}

/** The rows to show: blocked authors left out, ranks numbered again from 1, the first five. */
export function shelfRows(items: readonly TopItem[], blockedAuthorIds: readonly string[] = []): TopItem[] {
  return visibleTop({ items: [...items], total: items.length }, blockedAuthorIds).items.slice(0, SHELF_MIN)
}

/** The whole shelf shows only with a full five. */
export function shelfVisible(allRows: readonly TopItem[] | undefined): boolean {
  return (allRows?.length ?? 0) >= SHELF_MIN
}

export type ShelfCache = {
  get(kind: TopKind, now: number): TopItem[] | null
  set(kind: TopKind, items: TopItem[], now: number): void
  clear(): void
}

export function createShelfCache(ttlMs: number = SHELF_TTL_MS): ShelfCache {
  const store = new Map<TopKind, { at: number; items: TopItem[] }>()
  return {
    get(kind, now) {
      const hit = store.get(kind)
      return hit && now - hit.at < ttlMs ? hit.items : null
    },
    set(kind, items, now) {
      store.set(kind, { at: now, items })
    },
    clear: () => store.clear(),
  }
}

/** The raw rows of one kind: from the cache while fresh, else from the server (and remembered). */
export async function loadShelfKind(api: TopPlayedApi, kind: TopKind, cache: ShelfCache, now: number, signal?: AbortSignal): Promise<TopItem[]> {
  const hit = cache.get(kind, now)
  if (hit) return hit
  const page = await api.fetch(shelfQuery(kind), signal)
  cache.set(kind, page.items, now)
  return page.items
}
