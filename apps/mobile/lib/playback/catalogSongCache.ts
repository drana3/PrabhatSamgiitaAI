import type { MockSong } from "@/data/mock"

const cache = new Map<number, MockSong>()

export function cacheCatalogSong(song: MockSong) {
  if (song.audioUrl) cache.set(song.number, song)
}

export function getCachedCatalogSong(number: number): MockSong | undefined {
  return cache.get(number)
}

export function clearCatalogSongCache(): void {
  cache.clear()
}
