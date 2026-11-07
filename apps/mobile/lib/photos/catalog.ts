import { PHOTO_ASSETS } from "@/lib/photos/assets"
import { groupByCategory, pickFromList, type PickOptions } from "@/lib/photos/pick"
import { STOCK_PHOTO_META, type PhotoCategory, type PhotoMood, type StockPhotoMeta } from "@/lib/photos/photoData"

export type { PhotoCategory, PhotoMood, PhotoPeople, PhotoSource, PhotoTone, StockPhotoMeta } from "@/lib/photos/photoData"
export { STOCK_PHOTO_CREDITS } from "@/lib/photos/credits"
export { moodForText } from "@/lib/photos/pick"
export type { PickOptions } from "@/lib/photos/pick"

/**
 * Stock photos for Kiirtan covers, mixes, live-stream cards and artist placeholders.
 * Text over a photo always sits on a scrim (use `tint`); badges on photos are neutral dark glass with white text.
 */
export type StockPhoto = StockPhotoMeta & {
  /** up to 1400 px on the long side (never upscaled, see width/height), for heroes and cards (expo-image `source`) */
  cover: number
  /** up to 480 px wide, for rows and the mini player */
  thumb: number
}

export const STOCK_PHOTOS: readonly StockPhoto[] = STOCK_PHOTO_META.map((m) => ({
  ...m,
  cover: PHOTO_ASSETS[m.n].cover,
  thumb: PHOTO_ASSETS[m.n].thumb,
}))

/**
 * The same seed (a mix or track id) always gets the same photo. Warm first; cool only for night/long.
 * By default never a `children` or `close` photo (opt in with `{ allowPeople: true }`, for Stories/About) and never
 * a `lowRes` photo (pass `{ size: "small" }` for small covers and thumbnails).
 */
export function photoForSeed(seed: string, mood?: PhotoMood, opts?: PickOptions): StockPhoto {
  return pickFromList(STOCK_PHOTOS, seed, mood, opts) ?? (STOCK_PHOTOS.find((p) => p.people === "none") as StockPhoto)
}

export function photosByCategory(category: PhotoCategory): StockPhoto[] {
  return groupByCategory(STOCK_PHOTOS, category)
}

/** Mood of each system Kiirtan mix (lib/fixtures/kirtan.ts), so its cover fits: morning, evening, festival, calm. */
const MIX_MOOD: Record<string, PhotoMood> = { morning: "morning", evening: "evening", dipavali: "festival", bnk: "calm" }

/** The cover photo of a system mix: stable per mix id, by its mood. Default rules (no close or children photos, no lowRes). */
export function photoForMix(id: string): StockPhoto {
  return photoForSeed(id, MIX_MOOD[id])
}
