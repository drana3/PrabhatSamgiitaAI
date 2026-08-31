import type { MockSong } from "@/data/mock"

export type PlayerPlaybackSlice = {
  currentSong: MockSong | null
  isPlaying: boolean
  isBuffering: boolean
}

export type SongPlayback = {
  isCurrent: boolean
  /** Pause icon — this song is active and playback is on (includes buffering). */
  showPause: boolean
  isBuffering: boolean
}

export function isSameSong(
  current: Pick<MockSong, "id" | "number"> | null | undefined,
  song: Pick<MockSong, "id" | "number">,
): boolean {
  if (!current) return false
  if (current.id === song.id) return true
  return Number(current.number) === Number(song.number)
}

/** Same catalog song and the same audio stream (alternate recordings are distinct). */
export function isSameAudioTrack(
  current: Pick<MockSong, "id" | "number" | "audioUrl"> | null | undefined,
  song: Pick<MockSong, "id" | "number" | "audioUrl">,
): boolean {
  if (!isSameSong(current, song)) return false
  const currentUrl = (current?.audioUrl || "").trim()
  const songUrl = (song.audioUrl || "").trim()
  // Two URL-less stubs (common for song 1 after home warm) are not a loaded track yet.
  if (!currentUrl && !songUrl) return false
  // Hydrated player vs list/search row missing URL — same song, same stream.
  if (!currentUrl || !songUrl) return true
  return currentUrl === songUrl
}

/** Single playback status used by mini player, song page, home, lists, etc. */
export function songPlayback(
  state: PlayerPlaybackSlice,
  song: Pick<MockSong, "id" | "number">,
): SongPlayback {
  const isCurrent = isSameSong(state.currentSong, song)
  return {
    isCurrent,
    showPause: isCurrent && state.isPlaying,
    isBuffering: isCurrent && state.isBuffering,
  }
}
