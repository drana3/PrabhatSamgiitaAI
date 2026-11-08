import type { MockSong } from "@/data/mock"
import { versionsFromSong, versionSummary } from "@/lib/playerV2/versions"
import type { LoudnessClass } from "@/lib/loudness/levels"
import { loudnessClassOf, songLoudness } from "@/lib/loudness/songLevel"

export type CatalogTrack = {
  id: string
  url: string
  title: string
  artist?: string
  artwork?: string
  duration?: number
  /** Measured loudness of the file (volume leveling, lib/loudness); absent when not measured. */
  loudnessLufs?: number
  truePeakDb?: number
  loudnessClass?: LoudnessClass
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

/** The measured loudness that goes with this URL: the one of its own recording, else the song's. */
function loudnessFor(song: MockSong, url: string): Pick<CatalogTrack, "loudnessLufs" | "truePeakDb" | "loudnessClass"> {
  const own = song.audioRecordings?.find((r) => r.url === url)
  // A song can have several recordings: the numbers belong to the file being played, never to a sibling.
  const found = own
    ? typeof own.loudnessLufs === "number"
      ? { lufs: own.loudnessLufs, truePeakDb: typeof own.truePeakDb === "number" ? own.truePeakDb : null }
      : null
    : songLoudness(song)
  const cls = loudnessClassOf(song)
  if (!found) return { loudnessClass: cls }
  return {
    loudnessLufs: found.lufs,
    ...(found.truePeakDb === null ? {} : { truePeakDb: found.truePeakDb }),
    loudnessClass: cls,
  }
}

export function songToTrack(song: MockSong, url: string): CatalogTrack {
  return {
    ...loudnessFor(song, url),
    id: `ps-${song.number}`,
    url,
    title: lockScreenTitle(song.title),
    artist: lockScreenArtist(song, url),
    artwork: song.imageUrl || song.thumbnailUrl || undefined,
    // 0 means the length is not known: leave it out so the lock screen shows none until the file reports it
    duration: song.durationSeconds > 0 ? song.durationSeconds : undefined,
  }
}

export function trackIdToSongNumber(id: string | undefined | null): number | null {
  if (!id) return null
  const match = /^ps-(\d+)$/i.exec(id)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? n : null
}
