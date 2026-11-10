import { pickFromList, pickPool, hashSeed } from "@/lib/photos/pick"
import { STOCK_PHOTO_META, type StockPhotoMeta } from "@/lib/photos/photoData"

/**
 * Cover photo of a playlist, as plain data (no React, no image requires), so it is tested.
 *
 * The playlist model of the API has no cover column (user_playlists: id, name, description), and a new alembic
 * migration was not wanted, so the chosen photo is kept ON THIS PHONE, keyed by playlist id (stores/playlistCoverStore.ts).
 * What makes it work on a phone that has never seen the choice: a playlist without a stored choice shows a photo derived
 * from its id (`defaultCoverFor`), the same on every launch. Choosing a photo on one phone does not reach the others until
 * the API gets a field for it (TODO(api): cover photo number on the playlist).
 *
 * The pool is the library of docs/photo-system.md with nobody in the picture (the rule `photoWithoutPeople` uses), warm
 * tones first, small covers allowed (a cover is a tile or a 160 pt header, never a full-bleed hero).
 */

export type CoverPhoto = Pick<StockPhotoMeta, "n" | "id" | "title">

/** How many photos the picker shows at once. */
export const COVER_GRID_SIZE = 12

let poolCache: readonly StockPhotoMeta[] | null = null

/** Photos a playlist may wear: nobody in the picture, no Baba photograph, small sizes allowed. Stable order. */
export function coverPool(): readonly StockPhotoMeta[] {
  if (!poolCache) {
    const nobody = STOCK_PHOTO_META.filter((p) => p.people === "none")
    poolCache = pickPool(nobody, undefined, { size: "small" })
  }
  return poolCache
}

export function isCoverPhoto(n: unknown): n is number {
  return typeof n === "number" && coverPool().some((p) => p.n === n)
}

/** The photo a playlist shows when no choice is stored: stable per id (FNV-1a of the id picks from the pool). */
export function defaultCoverFor(id: string): number {
  const pool = coverPool()
  const hit = pickFromList(pool, id, undefined, { size: "small" })
  return (hit ?? pool[0]).n
}

/** The photo to draw: the stored choice when it is still a valid cover, else the one derived from the id. */
export function resolveCover(id: string, chosen: number | null | undefined): number {
  return isCoverPhoto(chosen) ? chosen : defaultCoverFor(id)
}

/**
 * A random photo for a new playlist. `rng` is injectable for tests (Math.random in the app). `avoid` keeps the photo
 * different from the one the playlist has now (Shuffle another) or from the previous new playlist.
 */
export function randomCover(rng: () => number = Math.random, avoid?: number | null): number {
  const pool = coverPool()
  const candidates = avoid == null ? pool : pool.filter((p) => p.n !== avoid)
  const list = candidates.length ? candidates : pool
  const index = Math.min(list.length - 1, Math.max(0, Math.floor(rng() * list.length)))
  return list[index].n
}

/**
 * The grid of the photo picker: `size` photos, the current one first (so it is always on screen and marked), then the
 * rest in an order that depends on `round` only. Round 0 is the first view; "Shuffle another" asks for round + 1.
 * Deterministic for (current, round), so a re-render never reshuffles under the finger.
 */
export function coverChoices(current: number, round: number, size: number = COVER_GRID_SIZE): number[] {
  const pool = coverPool()
  const others = pool
    .filter((p) => p.n !== current)
    .map((p) => ({ n: p.n, key: hashSeed(`${round}:${p.n}`) }))
    .sort((a, b) => a.key - b.key || a.n - b.n)
    .map((p) => p.n)
  const head = pool.some((p) => p.n === current) ? [current] : []
  return [...head, ...others].slice(0, size)
}

/**
 * The next free default name: `Playlist 5` when four exist. A name already taken (any case) is skipped, so
 * deleting the middle one never produces a duplicate. `format` makes the screen-language name (t("songs.playlistDefault")).
 */
export function defaultPlaylistName(
  existing: readonly { name: string }[],
  format: (n: number) => string = (n) => `Playlist ${n}`,
): string {
  const taken = new Set(existing.map((p) => p.name.trim().toLowerCase()))
  let n = existing.length + 1
  while (taken.has(format(n).toLowerCase())) n += 1
  return format(n)
}

/** A name to save: trimmed, whitespace collapsed, at most 120 characters (the API limit). Null when empty. */
export function cleanPlaylistName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 120)
  return name.length ? name : null
}
