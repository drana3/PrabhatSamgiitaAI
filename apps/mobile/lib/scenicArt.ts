/** Shared Unsplash scenic art — sized for mobile (hero vs list thumb). */

const SCENIC_PHOTO_IDS = [
  "photo-1495616811223-4d98b6e70c9a", // sunrise
  "photo-1507525428034-b723cf961d3e", // dawn lake
  "photo-1518709268805-4e9042af9f23", // lotus
  "photo-1470252649378-9c29740c9fa8", // dusk
  "photo-1502082553048-f009c37129b9", // mist
  "photo-1469474968028-56623f02e42e", // mountains
  "photo-1441974231531-c6227db76b6e", // meadow
  "photo-1439066615861-d1af74d74000", // river
] as const

function unsplashUri(photoId: string, width: number, quality: number) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${width}&q=${quality}`
}

export function scenicHeroFor(number: number) {
  const id = SCENIC_PHOTO_IDS[Math.abs(number) % SCENIC_PHOTO_IDS.length]
  return unsplashUri(id, 720, 70)
}

export function scenicThumbFor(number: number) {
  const id = SCENIC_PHOTO_IDS[Math.abs(number) % SCENIC_PHOTO_IDS.length]
  return unsplashUri(id, 280, 60)
}

/** Hero URLs for background warming (smaller than the old 1200px assets). */
export const scenicHeroList = SCENIC_PHOTO_IDS.map((id) => unsplashUri(id, 720, 70))

/** Compact thumbs for list play buttons. */
export const scenicThumbList = SCENIC_PHOTO_IDS.map((id) => unsplashUri(id, 280, 60))
