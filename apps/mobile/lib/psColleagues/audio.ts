import type { WireAudio } from "./types"

/** The private bucket of the colleagues' recordings (Cloudflare R2). Keys below are relative to it. */
export const COLLEAGUE_AUDIO_BUCKET = "am-site-books-private"

export type ColleagueRecording = {
  songNumber: number
  fileName: string
  /** key inside the bucket, `audio-extractor/ps-audio/<number> <English title>.<ext>` */
  r2Key: string
  container: string
  bytes: number
  /** "uploaded": the file is in the bucket */
  status: string
  /** the one to play first */
  isCurrent: boolean
}

/**
 * THE BRIDGE to the colleagues' audio. Only a list: it gives, for a song, the recordings the archives brought, current
 * one first. Nothing is played from it yet: the bucket is private, so a phone needs a signed link from the API, and the
 * catalogue (`media` rows) does not know these files (docs/ps-colleagues.md says what is needed).
 */
export function colleagueRecordingsOf(wire: WireAudio | null | undefined, songNumber: number | null | undefined): ColleagueRecording[] {
  if (!wire || songNumber == null) return []
  const list = wire[String(songNumber)] ?? []
  return list
    .map((r) => ({
      songNumber,
      fileName: r.f,
      r2Key: r.k,
      container: r.f.includes(".") ? (r.f.split(".").pop() ?? "").toLowerCase() : "",
      bytes: r.b,
      status: r.st,
      isCurrent: r.cur,
    }))
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
}

/** Every song number the archives brought audio for. */
export function colleagueAudioSongs(wire: WireAudio | null | undefined): number[] {
  return Object.keys(wire ?? {}).map(Number).sort((a, b) => a - b)
}
