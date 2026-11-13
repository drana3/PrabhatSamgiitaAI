import { photoWithoutPeople, STOCK_PHOTOS, type StockPhoto } from "@/lib/photos/catalog"

/**
 * The picture for a Search card or tile: the shortlist photo with this number (lib/photos), or, when no number is given or the
 * number is not in the shortlist, the photo system's own pick for the key, from the pictures with nobody in them. Never a
 * person and never Baba (the photo rules in lib/photos/pick.ts exclude his photographs).
 */
export function searchPhoto(n: number | null | undefined, seed: string): StockPhoto {
  const own = n == null ? undefined : STOCK_PHOTOS.find((photo) => photo.n === n)
  return own ?? photoWithoutPeople(seed)
}
