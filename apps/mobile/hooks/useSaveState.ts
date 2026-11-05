import { useMemo } from "react"

import { EMPTY_SAVE_STATE, isSaved, itemKey, songIdOf, type SaveItem, type SaveState } from "@/lib/save/saveToSheet"
import { useKirtanStore } from "@/stores/kirtanStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

/**
 * Where a song or Kiirtan is saved: `inMine` (the saved songs, synced to the website favourites, or
 * the saved Kiirtans) and the ids of the playlists that hold it. `saved` is true for either.
 * Subscribes to primitives, so a row re-renders only when its own answer changes.
 */
export function useSaveState(item: SaveItem | null): SaveState & { saved: boolean } {
  const songId = item?.kind === "song" ? songIdOf(item.number) : null
  const kiirtanId = item?.kind === "kiirtan" ? item.id : null
  const songNumber = item?.kind === "song" ? item.number : null

  const songInMine = usePreferencesStore((s) => (songId ? s.savedSongIds.includes(songId) : false))
  const kiirtanInMine = useKirtanStore((s) => (kiirtanId ? s.savedIds.includes(kiirtanId) : false))
  const playlistKey = usePlaylistStore((s) =>
    songNumber == null
      ? ""
      : s.playlists
          .filter((p) => p.songs.some((song: { song_number: number }) => song.song_number === songNumber))
          .map((p) => p.id)
          .join("|"),
  )

  const key = item ? itemKey(item) : ""
  return useMemo(() => {
    if (!key) return { ...EMPTY_SAVE_STATE, saved: false }
    const state: SaveState = {
      inMine: key.startsWith("kiirtan:") ? kiirtanInMine : songInMine,
      playlistIds: playlistKey ? playlistKey.split("|") : [],
    }
    return { ...state, saved: isSaved(state) }
  }, [key, songInMine, kiirtanInMine, playlistKey])
}
