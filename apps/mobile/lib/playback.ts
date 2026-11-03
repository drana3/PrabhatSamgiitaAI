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
  const currentUrl = (current?.audioUrl ?? "").trim()
  const nextUrl = (song.audioUrl ?? "").trim()
  if (!currentUrl && !nextUrl) return false
  if (!currentUrl || !nextUrl) return true
  return currentUrl === nextUrl
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

export type PlayControlState = "loading" | "pause" | "play"

/**
 * What the big play button shows. Loading wins over the pause icon so the UI
 * never shows "pause" next to "Loading audio…" (BUG-27).
 */
export function playControlState(state: {
  isPlaying: boolean
  isBuffering: boolean
}): PlayControlState {
  if (state.isBuffering) return "loading"
  return state.isPlaying ? "pause" : "play"
}
