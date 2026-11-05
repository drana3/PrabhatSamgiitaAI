import { createdToast, nextPlaylistName, saveToast, songIdOf, type SaveItem } from "@/lib/save/saveToSheet"
import { useKirtanStore } from "@/stores/kirtanStore"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { t } from "@/lib/i18n"

/**
 * What a tick in the "Save to" sheet does to the stores. Mine is the saved songs (preferencesStore,
 * synced to the website favourites) or the saved Kiirtans (kirtanStore); a playlist is playlistStore.
 * Each returns a toast to show, or says the person has to sign in first (the stores decide that, we
 * invent no new rule), or an error message.
 */
export type SaveOutcome = { ok: true; toast: string; playlistId?: string } | { ok: false; needsAuth: true } | { ok: false; error: string }

/** Tick or untick Mine. */
export async function toggleMine(item: SaveItem): Promise<SaveOutcome> {
  if (item.kind === "kiirtan") {
    const now = useKirtanStore.getState().toggleSaved(item.id)
    return { ok: true, toast: saveToast(t("songs.mine"), now) }
  }
  const id = songIdOf(item.number)
  const was = usePreferencesStore.getState().savedSongIds.includes(id)
  const result = await usePreferencesStore.getState().toggleSaved(id)
  if (result.needsAuth) return { ok: false, needsAuth: true }
  return { ok: true, toast: saveToast(t("songs.mine"), !was) }
}

function failure(result: unknown): SaveOutcome {
  if (result && typeof result === "object" && "needsAuth" in result) return { ok: false, needsAuth: true }
  const message = result && typeof result === "object" && "error" in result ? String((result as { error: string }).error) : ""
  return { ok: false, error: message || t("save.err.generic") }
}

/** Tick or untick a playlist (songs only). */
export async function togglePlaylist(item: SaveItem, playlistId: string): Promise<SaveOutcome> {
  if (item.kind !== "song") return { ok: false, error: t("save.err.kiirtan") }
  const store = usePlaylistStore.getState()
  const playlist = store.playlists.find((p) => p.id === playlistId)
  if (!playlist) return { ok: false, error: t("save.err.notFound") }
  const has = playlist.songs.some((s: { song_number: number }) => s.song_number === item.number)
  const result = await (has ? store.removeSong(playlistId, item.number) : store.addSong(playlistId, item.number))
  if (!isPlaylist(result)) return failure(result)
  void store.flushSync()
  return { ok: true, toast: saveToast(playlist.name, !has) }
}

/** "New playlist": make a list with the next free name and put the song in it. */
export async function createPlaylistWith(item: SaveItem): Promise<SaveOutcome> {
  if (item.kind !== "song") return { ok: false, error: t("save.err.kiirtan") }
  const store = usePlaylistStore.getState()
  const name = nextPlaylistName(store.playlists)
  const created = await store.createPlaylist(name)
  if (!isPlaylist(created)) return failure(created)
  const added = await usePlaylistStore.getState().addSong(created.id, item.number)
  if (!isPlaylist(added)) return failure(added)
  void usePlaylistStore.getState().flushSync()
  return { ok: true, toast: createdToast(name), playlistId: created.id }
}
