import { nextPlayableInQueue, randomPlayableSongNumber } from "@/lib/playableAudio"

export type PlaybackMode = "default" | "playlist" | "random"

/** Explicit playlist / drive modes only — casual queues stay default (no auto-advance). */
export function resolvePlaybackMode(
  _queue: number[] | undefined,
  explicit?: PlaybackMode,
): PlaybackMode {
  if (explicit) return explicit
  return "default"
}

/** Whether the player should auto-advance when the current track ends. */
export function shouldAdvanceAfterTrackEnd(
  mode: PlaybackMode,
  currentNumber: number | null | undefined,
  queue: number[],
): boolean {
  if (!currentNumber) return false
  if (mode === "random") return true
  if (mode === "playlist") return playlistStep(currentNumber, queue, 1) != null
  return false
}

/** Drive repeat loops the current track instead of random / playlist advance. */
export function shouldAdvanceAfterTrackEndInDrive(
  mode: PlaybackMode,
  currentNumber: number | null | undefined,
  queue: number[],
  driveAutoAdvance: boolean,
  driveRepeat: boolean,
  _driveScreenFocused = true,
): boolean {
  if (!driveAutoAdvance && mode === "random") return false
  if (driveAutoAdvance && driveRepeat) return false
  return shouldAdvanceAfterTrackEnd(mode, currentNumber, queue)
}

/**
 * Saved playlists advance without Drive.
 * Random / drive playlist queues advance while `driveAutoAdvance` is on (including screen lock).
 */
export function shouldAutoAdvanceTrack(
  mode: PlaybackMode,
  currentNumber: number | null | undefined,
  queue: number[],
  driveAutoAdvance: boolean,
  driveRepeat: boolean,
  _driveScreenFocused: boolean,
): boolean {
  if (mode === "random") {
    if (!driveAutoAdvance) return false
    return shouldAdvanceAfterTrackEndInDrive(
      mode,
      currentNumber,
      queue,
      driveAutoAdvance,
      driveRepeat,
    )
  }
  if (driveAutoAdvance) {
    return shouldAdvanceAfterTrackEndInDrive(
      mode,
      currentNumber,
      queue,
      driveAutoAdvance,
      driveRepeat,
    )
  }
  return shouldAdvanceAfterTrackEnd(mode, currentNumber, queue)
}

/** Another catalog number, skipping the song that just played when possible. */
export function randomSongNumber(exclude: number, total = 5018): number {
  if (total <= 1) return 1
  let next = 1 + Math.floor(Math.random() * total)
  if (next === exclude) next = next === total ? 1 : next + 1
  return next
}

/** Next or previous number inside a playlist. Null means the playlist has no further song. */
export function nextQueueNumber(
  mode: PlaybackMode,
  current: number,
  queue: number[],
): number | null {
  if (mode === "random") return randomPlayableSongNumber(current)
  if (mode === "playlist") {
    return nextPlayableInQueue(queue, current, 1) ?? playlistStep(current, queue, 1)
  }
  const index = queue.indexOf(current)
  if (index >= 0 && index < queue.length - 1) return queue[index + 1] ?? null
  return null
}

export function previousQueueNumber(
  mode: PlaybackMode,
  current: number,
  queue: number[],
): number | null {
  if (mode === "playlist") {
    return nextPlayableInQueue(queue, current, -1) ?? playlistStep(current, queue, -1)
  }
  return null
}

export function canStepPlaylist(
  mode: PlaybackMode,
  current: number | null | undefined,
  queue: number[],
  direction: 1 | -1,
): boolean {
  if (!current) return false
  if (mode === "random") return true
  if (mode !== "playlist" || !queue.length) return false
  if (direction === 1) return nextQueueNumber(mode, current, queue) != null
  return previousQueueNumber(mode, current, queue) != null
}

/** Queue for the song page — keep an active playlist, otherwise related songs. */
export function listenQueueForSong(
  songNumber: number,
  relatedNumbers: number[],
  playbackMode: PlaybackMode,
  activeQueue: number[],
  playlistBounds?: number[] | null,
): number[] {
  if (playlistBounds?.length && playlistBounds.includes(songNumber)) {
    return playlistBounds
  }
  if (playbackMode === "playlist" && activeQueue.length > 1 && activeQueue.includes(songNumber)) {
    return activeQueue
  }
  return [songNumber, ...relatedNumbers]
}

export function playlistStep(current: number, queue: number[], direction: 1 | -1): number | null {
  const index = queue.indexOf(current)
  if (index < 0) return null
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= queue.length) return null
  return queue[nextIndex] ?? null
}

/** Member playlist / drive queue — never related-song expansion. */
export function playbackAdvanceQueue(
  mode: PlaybackMode,
  playlistBounds: number[] | null | undefined,
  queue: number[],
): number[] {
  if (mode === "playlist" && playlistBounds?.length) return playlistBounds
  return queue
}
