import type { PlaybackMode } from "@/lib/playbackQueue"

export type ActivePlaylistMeta = {
  id: string
  name: string
}

export function playlistQueueForPlayback(
  mode: PlaybackMode,
  playlistBounds: number[] | null | undefined,
  queue: number[],
): number[] {
  if (mode === "playlist" && playlistBounds?.length) return playlistBounds
  return queue
}

export function playlistPosition(
  bounds: number[] | null | undefined,
  currentNumber: number | null | undefined,
): { index: number; total: number } | null {
  if (!bounds?.length || currentNumber == null) return null
  const index = bounds.indexOf(currentNumber)
  if (index < 0) return null
  return { index, total: bounds.length }
}

export function playlistPlaybackSubtitle(
  mode: PlaybackMode,
  bounds: number[] | null | undefined,
  currentNumber: number | null | undefined,
  activePlaylist: ActivePlaylistMeta | null,
): string | null {
  if (mode !== "playlist" || !bounds?.length || currentNumber == null) return null
  const pos = playlistPosition(bounds, currentNumber)
  if (!pos) return activePlaylist?.name ?? "Playlist"
  const label = activePlaylist?.name ?? "Playlist"
  return `${label} · ${pos.index + 1} of ${pos.total}`
}

export function isActivePlaylistSong(
  mode: PlaybackMode,
  bounds: number[] | null | undefined,
  songNumber: number,
): boolean {
  return mode === "playlist" && Boolean(bounds?.includes(songNumber))
}

export function isPlaylistUnderPlay(
  mode: PlaybackMode,
  activePlaylistId: string | null | undefined,
  playlistId: string,
): boolean {
  return mode === "playlist" && Boolean(activePlaylistId) && activePlaylistId === playlistId
}

/** Short label for playlist list rows (name is shown separately). */
export function playlistNowPlayingRowMeta(
  mode: PlaybackMode,
  activePlaylistId: string | null | undefined,
  playlistId: string,
  bounds: number[] | null | undefined,
  currentNumber: number | null | undefined,
): string | null {
  if (!isPlaylistUnderPlay(mode, activePlaylistId, playlistId)) return null
  const pos = playlistPosition(bounds, currentNumber)
  if (!pos) return "Playing now"
  return `Playing now · ${pos.index + 1} of ${pos.total}`
}
