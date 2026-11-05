import { PHOTO_ASSETS } from "@/lib/photos/assets"
import { groupByCategory, pickFromList } from "@/lib/photos/pick"
import { STOCK_PHOTO_META, type PhotoCategory, type PhotoMood, type StockPhotoMeta } from "@/lib/photos/photoData"

export type { PhotoCategory, PhotoMood, PhotoTone, StockPhotoMeta } from "@/lib/photos/photoData"
export { STOCK_PHOTO_CREDITS } from "@/lib/photos/credits"
export { moodForText } from "@/lib/photos/pick"

/**
 * Stock photos for Kiirtan covers, mixes, live-stream cards and artist placeholders.
 * Text over a photo always sits on a scrim (use `tint`); badges on photos are neutral dark glass with white text.
 */
export type StockPhoto = StockPhotoMeta & {
  /** 1400 px wide, for heroes and cards (expo-image `source`) */
  cover: number
  /** 480 px wide, for rows and the mini player */
  thumb: number
}

export const STOCK_PHOTOS: readonly StockPhoto[] = STOCK_PHOTO_META.map((m) => ({
  ...m,
  cover: PHOTO_ASSETS[m.n].cover,
  thumb: PHOTO_ASSETS[m.n].thumb,
}))

/** The same seed (a mix or track id) always gets the same photo. Warm first; cool only for night/long. */
export function photoForSeed(seed: string, mood?: PhotoMood): StockPhoto {
  return pickFromList(STOCK_PHOTOS, seed, mood)
}

export function photosByCategory(category: PhotoCategory): StockPhoto[] {
  return groupByCategory(STOCK_PHOTOS, category)
}
