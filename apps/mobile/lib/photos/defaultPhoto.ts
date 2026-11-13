import { KIND_MOOD } from "@/lib/photos/recordingPhoto"
import { hashSeed, moodForText, pickPool } from "@/lib/photos/pick"
import type { PhotoMood, StockPhotoMeta } from "@/lib/photos/photoData"
import type { RecordingKind } from "@/lib/kirtan/types"

/**
 * Default pictures (Dada, 13 Nov 2026), chosen by the SYSTEM from the photos already in the app (docs/photo-system.md):
 *  - a TILE of a kind (Kiirtan, Bhajan, Discourses ...) gets one photo for the kind, the same every time, and the six tiles of a page
 *    get six different photos while the pool is large enough;
 *  - a LIVE broadcast (a tile, its page, a preview) never shows video: it gets one photo by its id, the same every time.
 * Pure: the list is passed in, so this runs in tests without images.
 */

type Pickable = Pick<StockPhotoMeta, "tone" | "moods"> & Partial<Pick<StockPhotoMeta, "people" | "lowRes" | "subject">>

/** The seed of a kind's tile photo. */
export const kindPhotoSeed = (kind: RecordingKind): string => `kind:${kind}`

/** The seed of a broadcast's photo: its id, so a broadcast keeps one photo on the tile, the page and the preview. */
export const broadcastPhotoSeed = (broadcastId: string): string => `broadcast:${broadcastId}`

/** The mood of a broadcast's photo: its title when it says one (evening, festival ...), else the lively `live`. */
export function broadcastPhotoMood(title: string | null | undefined): PhotoMood {
  return moodForText(title ?? "") ?? "live"
}

/**
 * One photo per kind, all different from each other (as far as the pool allows): each kind starts at the place its seed
 * hashes to, and steps on to the next photo of its pool while a kind before it already has that one. Same list in, same photos out.
 */
export function pickKindPhotos<T extends Pickable>(list: readonly T[], kinds: readonly RecordingKind[]): Map<RecordingKind, T | undefined> {
  const used = new Set<T>()
  const out = new Map<RecordingKind, T | undefined>()
  for (const kind of kinds) {
    const pool = pickPool(list, KIND_MOOD[kind], { size: "small" })
    if (pool.length === 0) {
      out.set(kind, undefined)
      continue
    }
    const start = hashSeed(kindPhotoSeed(kind)) % pool.length
    let chosen = pool[start]
    for (let step = 0; step < pool.length; step++) {
      const candidate = pool[(start + step) % pool.length]
      if (!used.has(candidate)) {
        chosen = candidate
        break
      }
    }
    used.add(chosen)
    out.set(kind, chosen)
  }
  return out
}
