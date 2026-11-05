/**
 * "Save to" as plain data (no React), so what the sheet lists and says is unit tested.
 * Spotify's model in the app's own words: one circle-plus button per song or Kiirtan opens a sheet
 * with "Mine" (the saved songs, synced to the website favourites) and the person's playlists.
 * A song can sit in Mine and in several playlists at once; the button shows a check when it is in any.
 * Kiirtans are saved in Mine only: playlists hold songs today.
 * TODO(api): Kiirtans in playlists need the backend.
 */

export type SaveItem = { kind: "song"; number: number } | { kind: "kiirtan"; id: string }

/** The part of a playlist this logic reads (a MemberPlaylist fits). */
export type PlaylistLike = {
  id: string
  name: string
  created_at?: string
  songs: readonly { song_number: number }[]
}

export type SaveState = { inMine: boolean; playlistIds: string[] }

export const EMPTY_SAVE_STATE: SaveState = { inMine: false, playlistIds: [] }

/** The id the favourites use for a song: `ps-12`. */
export function songIdOf(number: number): string {
  return `ps-${number}`
}

/** A stable key for an item, for lists and memo keys. */
export function itemKey(item: SaveItem): string {
  return item.kind === "song" ? songIdOf(item.number) : `kiirtan:${item.id}`
}

/** Item from a song id (`ps-12`, as the song page and the stores use). Null for any other id. */
export function itemFromSongId(songId: string): SaveItem | null {
  const match = /^ps-(\d+)$/i.exec(songId)
  if (!match) return null
  const number = Number(match[1])
  return Number.isFinite(number) ? { kind: "song", number } : null
}

/** Add the id if it is missing, remove it if it is there. Never mutates, never doubles. */
export function toggleMembership(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

/** Where an item sits right now. Pure: the hook passes in the store values. */
export function computeSaveState(
  item: SaveItem,
  input: {
    savedSongIds: readonly string[]
    kiirtanSavedIds: readonly string[]
    playlists: readonly PlaylistLike[]
  },
): SaveState {
  if (item.kind === "kiirtan") {
    return { inMine: input.kiirtanSavedIds.includes(item.id), playlistIds: [] }
  }
  return {
    inMine: input.savedSongIds.includes(songIdOf(item.number)),
    playlistIds: input.playlists
      .filter((p) => p.songs.some((s) => s.song_number === item.number))
      .map((p) => p.id),
  }
}

/** True when the item is in Mine or in any playlist: the button shows the check. */
export function isSaved(state: SaveState): boolean {
  return state.inMine || state.playlistIds.length > 0
}

/** Same state, so a selector can keep the old object and skip a re-render. */
export function sameSaveState(a: SaveState, b: SaveState): boolean {
  return (
    a.inMine === b.inMine &&
    a.playlistIds.length === b.playlistIds.length &&
    a.playlistIds.every((id, i) => id === b.playlistIds[i])
  )
}

/** Newest playlist first. Uses `created_at` when both have it, else the order they were made in. */
export function orderPlaylists<T extends PlaylistLike>(playlists: readonly T[]): T[] {
  return playlists
    .map((playlist, index) => ({ playlist, index }))
    .sort((a, b) => {
      const at = a.playlist.created_at ? Date.parse(a.playlist.created_at) : NaN
      const bt = b.playlist.created_at ? Date.parse(b.playlist.created_at) : NaN
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at
      return b.index - a.index
    })
    .map((entry) => entry.playlist)
}

/** `1 song`, `12 songs`. */
export function trackCountLabel(count: number): string {
  return `${count} ${count === 1 ? "song" : "songs"}`
}

export const MINE_NAME = "Mine"
export const MINE_SUBTITLE = "Saved songs"
export const MINE_SUBTITLE_KIIRTAN = "Saved songs, Kiirtans and Bhajans"

export type SaveRow =
  | { kind: "mine"; name: string; subtitle: string; on: boolean }
  | { kind: "playlist"; id: string; name: string; subtitle: string; on: boolean }

/** The rows of the sheet: Mine first, then the playlists, newest first. A Kiirtan lists Mine only. */
export function buildSaveRows(
  item: SaveItem,
  state: SaveState,
  playlists: readonly PlaylistLike[],
): SaveRow[] {
  const rows: SaveRow[] = [
    {
      kind: "mine",
      name: MINE_NAME,
      subtitle: item.kind === "kiirtan" ? MINE_SUBTITLE_KIIRTAN : MINE_SUBTITLE,
      on: state.inMine,
    },
  ]
  if (item.kind === "kiirtan") return rows
  for (const playlist of orderPlaylists(playlists)) {
    rows.push({
      kind: "playlist",
      id: playlist.id,
      name: playlist.name,
      subtitle: trackCountLabel(playlist.songs.length),
      on: state.playlistIds.includes(playlist.id),
    })
  }
  return rows
}

/** Toast after a tick or untick. `target` is "Mine" or the playlist name. */
export function saveToast(target: string, added: boolean): string {
  return added ? `Added to ${target}` : `Removed from ${target}`
}

/** Toast after "New playlist" made a list and put the song in it. */
export function createdToast(playlistName: string): string {
  return `Added to ${playlistName}`
}

/** Screen-reader label of the circle button. */
export function saveButtonLabel(saved: boolean): string {
  return saved ? "Saved. Change" : "Add to…"
}

/** A name for the next new playlist: `Playlist 3` when two exist and `Playlist 3` is free. */
export function nextPlaylistName(existing: readonly { name: string }[]): string {
  const taken = new Set(existing.map((p) => p.name.trim().toLowerCase()))
  let n = existing.length + 1
  while (taken.has(`playlist ${n}`)) n += 1
  return `Playlist ${n}`
}

/** The button sizes the design allows. */
export type SaveButtonSize = 22 | 24 | 28
