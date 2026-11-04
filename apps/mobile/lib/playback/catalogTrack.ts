import type { MockSong } from "@/data/mock"
import { versionsFromSong, versionSummary } from "@/lib/playerV2/versions"

export type CatalogTrack = {
  id: string
  url: string
  title: string
  artist?: string
  artwork?: string
  duration?: number
}

/** "BANDHU HE NIYE CALO" to "Bandhu He Niye Calo" for the lock screen; mixed-case titles are kept. */
export function lockScreenTitle(title: string): string {
  const clean = title.trim()
  if (!clean || clean !== clean.toUpperCase() || clean === clean.toLowerCase()) return clean
  return clean
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, lead: string, letter: string) => lead + letter.toUpperCase())
}

/** `PS 1 · Voice · Performer A` under the title (prototype SysIosLock / SysAndLock). */
export function lockScreenArtist(song: MockSong, url: string): string {
  const versions = versionsFromSong({ number: song.number, audioUrl: url || song.audioUrl, audioRecordings: song.audioRecordings })
  const version = versions.find((v) => v.url === url) ?? versions[0]
  return version ? `PS ${song.number} · ${versionSummary(version)}` : `PS ${song.number}`
}

export function songToTrack(song: MockSong, url: string): CatalogTrack {
  return {
    id: `ps-${song.number}`,
    url,
    title: lockScreenTitle(song.title),
    artist: lockScreenArtist(song, url),
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
