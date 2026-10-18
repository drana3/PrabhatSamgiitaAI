import { resolvePreferredAudioUrl, type RankedAudio } from "@prabhat/core"

const STORAGE_KEY = "ps.preferred-audio"

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
      ),
    )
  } catch {
    return {}
  }
}

export function readPreferredAudio(songNumber: number): string | null {
  return readMap()[String(songNumber)] ?? null
}

export function writePreferredAudio(songNumber: number, url: string | null) {
  if (typeof window === "undefined") return
  try {
    const next = readMap()
    const key = String(songNumber)
    if (!url) delete next[key]
    else next[key] = url
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
}

export function defaultSongAudioUrl(recordings: RankedAudio[], songNumber: number) {
  return resolvePreferredAudioUrl(recordings, readPreferredAudio(songNumber))
}
