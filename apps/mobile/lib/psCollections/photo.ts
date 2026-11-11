import { photoWithoutPeople, type PhotoMood, type StockPhoto } from "@/lib/photos/catalog"

/**
 * Pictures of the collection screens (Dada, 11 Nov 2026: photographs, not letters). Always from the photo system's
 * pictures with nobody in them (never a person, never Baba), and the same seed always gets the same photo, so a tile
 * or a song row does not jump when the list is filtered, sorted or opened again.
 */
const cache = new Map<string, StockPhoto>()

export function seededPhoto(seed: string, mood?: PhotoMood): StockPhoto {
  const key = `${mood ?? ""}|${seed}`
  let photo = cache.get(key)
  if (!photo) {
    photo = photoWithoutPeople(seed, mood)
    cache.set(key, photo)
  }
  return photo
}

/** The photo of a song row: by the song number. */
export function songPhoto(number: number): StockPhoto {
  return seededPhoto(`ps-${Math.abs(Math.trunc(number)) || 0}`)
}

/** The photo of a collection: by its key (or a name), warm for a mood the name asks for. */
export function collectionPhoto(seed: string, mood?: PhotoMood): StockPhoto {
  return seededPhoto(`collection:${seed}`, mood)
}
