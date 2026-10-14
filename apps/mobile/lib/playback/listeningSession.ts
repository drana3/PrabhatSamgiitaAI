import type { ActivePlaylistMeta } from "@/lib/playlistPlayback"
import { shouldAdvanceAfterTrackEnd, type PlaybackMode } from "@/lib/playbackQueue"

/** Product-level listening contract — not expo-av details. */
export type ListeningSession =
  | { kind: "casual" }
  | { kind: "playlist"; bounds: number[]; activePlaylist: ActivePlaylistMeta | null }
  | { kind: "drive-random" }
  | { kind: "drive-playlist"; bounds: number[]; activePlaylist: ActivePlaylistMeta | null }

export type StoreSessionSlice = {
  playbackMode: PlaybackMode
  playlistBounds: number[] | null
  activePlaylist: ActivePlaylistMeta | null
  driveAutoAdvance: boolean
  driveScreenFocused?: boolean
  queue?: number[]
}

function playlistBoundsFromState(state: StoreSessionSlice): number[] | null {
  if (state.playlistBounds?.length) return state.playlistBounds
  if (state.playbackMode === "playlist" && state.queue?.length) return state.queue
  return null
}

/** Map legacy store flags to an explicit session (until store holds `listeningSession` directly). */
export function listeningSessionFromStore(state: StoreSessionSlice): ListeningSession {
  if (state.playbackMode === "random" && state.driveAutoAdvance) {
    return { kind: "drive-random" }
  }
  const bounds = playlistBoundsFromState(state)
  if (state.playbackMode === "playlist" && bounds?.length) {
    if (state.driveAutoAdvance) {
      return {
        kind: "drive-playlist",
        bounds,
        activePlaylist: state.activePlaylist,
      }
    }
    return {
      kind: "playlist",
      bounds,
      activePlaylist: state.activePlaylist,
    }
  }
  return { kind: "casual" }
}

export function sessionAutoAdvanceWhileLocked(session: ListeningSession): boolean {
  return session.kind === "drive-random" || session.kind === "drive-playlist"
}

export function sessionEndsOnLeaveDrive(session: ListeningSession): boolean {
  return session.kind === "drive-random" || session.kind === "drive-playlist"
}

/** Random mode left over after Drive exit without a live drive session. */
export function isStaleRandomWithoutDrive(state: StoreSessionSlice): boolean {
  return (
    state.playbackMode === "random" &&
    !state.driveAutoAdvance &&
    !state.driveScreenFocused
  )
}

/** Whether track-end should fetch/advance to another catalog song (repeat handled separately). */
export function sessionShouldAdvanceAfterTrackEnd(
  session: ListeningSession,
  driveRepeat: boolean,
  currentNumber: number | null | undefined,
  queue: number[],
): boolean {
  if (!currentNumber || driveRepeat) return false
  switch (session.kind) {
    case "casual":
      return false
    case "playlist":
      return shouldAdvanceAfterTrackEnd("playlist", currentNumber, queue)
    case "drive-random":
      return true
    case "drive-playlist":
      return shouldAdvanceAfterTrackEnd("playlist", currentNumber, queue)
  }
}

export function sessionAllowsUnplayableAutoSkip(session: ListeningSession): boolean {
  return session.kind !== "casual"
}

export function sessionAllowsCatalogPreload(session: ListeningSession): boolean {
  return session.kind === "casual"
}

/** Fetch next track URL while the current song is still playing (no second AVPlayer). */
export function sessionPrefetchesNextMetadata(session: ListeningSession): boolean {
  return (
    session.kind === "drive-random" ||
    session.kind === "drive-playlist" ||
    session.kind === "playlist"
  )
}
