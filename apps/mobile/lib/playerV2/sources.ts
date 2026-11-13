import type { PlaybackMode } from "@/lib/playbackQueue"
import { t } from "@/lib/i18n"

/** The three kinds of list the Player can play from (prototype "Play songs from"). */
export type SourceKey = "all" | "mine" | `pl:${string}`

export type SourceRow = { key: SourceKey; name: string; meta: string }

export type SourcePlaylist = { id: string; name: string; count: number }

/** Playlist id used for the "Mine" list so the engine can run it in playlist mode (bounded loop). */
export const MINE_SOURCE_ID = "mine"

function songs(count: number): string {
  return t("songs.count", { count })
}

/** Rows of the "Play songs from" sheet: All songs, Mine, then every playlist. */
export function sourceRows(input: { catalogCount: number; savedCount: number; playlists: SourcePlaylist[] }): SourceRow[] {
  return [
    { key: "all", name: t("songs.allSongs"), meta: songs(input.catalogCount) },
    { key: "mine", name: t("songs.mine"), meta: t("player.src.saved", { count: input.savedCount }) },
    ...input.playlists.map((p) => ({ key: `pl:${p.id}` as const, name: p.name, meta: t("player.src.playlistMeta", { count: p.count }) })),
  ]
}

/** Which row is ticked, from what the engine is playing from. */
export function activeSourceKey(playbackMode: PlaybackMode, activePlaylistId: string | null | undefined): SourceKey {
  if (playbackMode !== "playlist" || !activePlaylistId) return "all"
  return activePlaylistId === MINE_SOURCE_ID ? "mine" : `pl:${activePlaylistId}`
}

/** The toast after picking a source: "Playing {name}", or why nothing started. */
export function sourcePickedMessage(name: string, count: number): string {
  return count > 0 ? t("player.src.playing", { name }) : t("player.src.empty", { name })
}

/** Where a list starts: the current song when it is in the list, else the first one that has audio. */
export function startNumber(numbers: readonly number[], current: number | null, hasAudio: (n: number) => boolean): number | null {
  if (!numbers.length) return null
  if (current != null && numbers.includes(current) && hasAudio(current)) return current
  return numbers.find(hasAudio) ?? numbers[0] ?? null
}
