import type { MockSong } from "@/data/mock"

export type CatalogTrack = {
  id: string
  url: string
  title: string
  artist?: string
  artwork?: string
  duration?: number
}

export function songToTrack(song: MockSong, url: string): CatalogTrack {
  return {
    id: `ps-${song.number}`,
    url,
    title: song.title,
    artist: song.performer || "Prabhat Samgiita",
    artwork: song.imageUrl || song.thumbnailUrl || undefined,
    duration: song.durationSeconds,
  }
}

export function trackIdToSongNumber(id: string | undefined | null): number | null {
  if (!id) return null
  const match = /^ps-(\d+)$/i.exec(id)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? n : null
}
