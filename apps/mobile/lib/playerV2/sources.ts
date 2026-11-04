import type { PlaybackMode } from "@/lib/playbackQueue"

/** The three kinds of list the Player can play from (prototype "Play songs from"). */
export type SourceKey = "all" | "mine" | `pl:${string}`

export type SourceRow = { key: SourceKey; name: string; meta: string }

export type SourcePlaylist = { id: string; name: string; count: number }

/** Playlist id used for the "Mine" list so the engine can run it in playlist mode (bounded loop). */
export const MINE_SOURCE_ID = "mine"

function songs(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "song" : "songs"}`
}

/** Rows of the "Play songs from" sheet: All songs, Mine, then every playlist. */
export function sourceRows(input: { catalogCount: number; savedCount: number; playlists: SourcePlaylist[] }): SourceRow[] {
  return [
    { key: "all", name: "All songs", meta: songs(input.catalogCount) },
    { key: "mine", name: "Mine", meta: `${input.savedCount} saved` },
    ...input.playlists.map((p) => ({ key: `pl:${p.id}` as const, name: p.name, meta: `${songs(p.count)}, playlist` })),
  ]
}

/** Which row is ticked, from what the engine is playing from. */
export function activeSourceKey(playbackMode: PlaybackMode, activePlaylistId: string | null | undefined): SourceKey {
  if (playbackMode !== "playlist" || !activePlaylistId) return "all"
  return activePlaylistId === MINE_SOURCE_ID ? "mine" : `pl:${activePlaylistId}`
}

/** The toast after picking a source: "Playing {name}", or why nothing started. */
export function sourcePickedMessage(name: string, count: number): string {
  return count > 0 ? `Playing ${name}` : `Nothing in ${name} yet`
}

/** Where a list starts: the current song when it is in the list, else the first one that has audio. */
export function startNumber(numbers: readonly number[], current: number | null, hasAudio: (n: number) => boolean): number | null {
  if (!numbers.length) return null
  if (current != null && numbers.includes(current) && hasAudio(current)) return current
  return numbers.find(hasAudio) ?? numbers[0] ?? null
}
