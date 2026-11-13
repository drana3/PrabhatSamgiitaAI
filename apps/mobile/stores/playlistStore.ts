import type { MemberPlaylist } from "@prabhat/core"
import { create } from "zustand"

import { ownerKeyOf } from "@/lib/account/owner"
import { api } from "@/lib/client"
import { memberAuthAvailable } from "@/lib/memberAuth"
import {
  clearPlaylistCache,
  peekPlaylistCache,
  readPlaylistCache,
  writePlaylistCache,
  writePlaylistCacheSoon,
} from "@/lib/playlistCache"
import {
  bindPlaylistSyncHandlers,
  enqueuePlaylistSync,
  flushPlaylistSyncNow,
  resetPlaylistSyncQueue,
} from "@/lib/playlistSyncQueue"
import { useAuthStore } from "@/stores/authStore"
import { usePlaylistCoverStore } from "@/stores/playlistCoverStore"

type PlaylistResult = MemberPlaylist | { needsAuth: true } | { error: string }

type PlaylistState = {
  playlists: MemberPlaylist[]
  loading: boolean
  syncing: boolean
  error: string | null
  /** Paint cached playlists on Saved without waiting on the network. */
  hydrateFromCache: () => Promise<void>
  refresh: () => Promise<void>
  createPlaylist: (name: string) => Promise<PlaylistResult>
  renamePlaylist: (id: string, name: string) => Promise<PlaylistResult>
  deletePlaylist: (id: string) => Promise<{ ok: true } | { needsAuth: true } | { error: string }>
  addSong: (id: string, songNumber: number) => Promise<PlaylistResult>
  removeSong: (id: string, songNumber: number) => Promise<PlaylistResult>
  flushSync: () => Promise<void>
}

function currentOwner() {
  return ownerKeyOf(useAuthStore.getState())
}

function signedIn() {
  return useAuthStore.getState().mode === "signed_in"
}

function memberReady(): { needsAuth: true } | { error: string } | null {
  if (!signedIn()) return { needsAuth: true }
  if (!memberAuthAvailable()) {
    return { error: "Playlist sync is not available in this build yet." }
  }
  return null
}

function replacePlaylist(list: MemberPlaylist[], next: MemberPlaylist) {
  const index = list.findIndex((item) => item.id === next.id)
  if (index < 0) return [...list, next]
  const copy = list.slice()
  copy[index] = next
  return copy
}

function newLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function optimisticAddSong(playlist: MemberPlaylist, songNumber: number): MemberPlaylist {
  if (playlist.songs.some((song) => song.song_number === songNumber)) return playlist
  const position =
    playlist.songs.reduce((max, song) => Math.max(max, song.position), 0) + 1
  return {
    ...playlist,
    songs: [...playlist.songs, { song_number: songNumber, position }],
  }
}

function optimisticRemoveSong(playlist: MemberPlaylist, songNumber: number): MemberPlaylist {
  const songs = playlist.songs
    .filter((song) => song.song_number !== songNumber)
    .sort((a, b) => a.position - b.position)
    .map((song, index) => ({ ...song, position: index + 1 }))
  return { ...playlist, songs }
}

function persistSoon(playlists: MemberPlaylist[]) {
  writePlaylistCacheSoon(playlists)
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  loading: false,
  syncing: false,
  error: null,

  hydrateFromCache: async () => {
    if (!signedIn() || !memberAuthAvailable()) return
    const cached = peekPlaylistCache() ?? (await readPlaylistCache()) ?? []
    if (get().playlists.length === 0) {
      set({ playlists: cached, loading: false, error: null })
    }
  },

  refresh: async () => {
    if (!signedIn() || !memberAuthAvailable()) {
      await clearPlaylistsOnDevice()
      return
    }
    const owner = currentOwner()
    const cached = peekPlaylistCache() ?? (await readPlaylistCache()) ?? []
    if (currentOwner() !== owner) return
    set({ playlists: cached, loading: false, error: null })
    const remote = await api.fetchMemberPlaylists()
    // Signed out or into another account while the list was loading: it is not for whoever is here now.
    if (currentOwner() !== owner) return
    if (remote === null) {
      set((state) => ({
        loading: false,
        error: state.playlists.length ? null : "Could not load playlists.",
      }))
      return
    }
    await writePlaylistCache(remote, owner)
    if (currentOwner() !== owner) return
    set({ playlists: remote, loading: false, error: null })
  },

  flushSync: async () => {
    await flushPlaylistSyncNow()
  },

  createPlaylist: async (name) => {
    const blocked = memberReady()
    if (blocked) return blocked
    const trimmed = name.trim()
    if (!trimmed) return { error: "Enter a playlist name." }
    const tempId = newLocalId()
    const optimistic: MemberPlaylist = {
      id: tempId,
      name: trimmed,
      songs: [],
      created_at: new Date().toISOString(),
    }
    const playlists = [...get().playlists, optimistic]
    set({ playlists, error: null })
    persistSoon(playlists)
    // every new playlist gets its own random cover photo, kept on the phone (stores/playlistCoverStore.ts)
    usePlaylistCoverStore.getState().assignRandom(tempId)
    enqueuePlaylistSync({ type: "create", tempId, name: trimmed })
    return optimistic
  },

  renamePlaylist: async (id, name) => {
    const blocked = memberReady()
    if (blocked) return blocked
    const trimmed = name.trim()
    if (!trimmed) return { error: "Enter a playlist name." }
    const current = get().playlists.find((item) => item.id === id)
    if (!current) return { error: "Playlist not found." }
    const updated = { ...current, name: trimmed }
    const playlists = replacePlaylist(get().playlists, updated)
    set({ playlists, error: null })
    persistSoon(playlists)
    enqueuePlaylistSync({ type: "rename", id, name: trimmed })
    return updated
  },

  deletePlaylist: async (id) => {
    const blocked = memberReady()
    if (blocked) return blocked
    const playlists = get().playlists.filter((item) => item.id !== id)
    set({ playlists, error: null })
    persistSoon(playlists)
    usePlaylistCoverStore.getState().remove(id)
    enqueuePlaylistSync({ type: "delete", id })
    return { ok: true }
  },

  addSong: async (id, songNumber) => {
    const blocked = memberReady()
    if (blocked) return blocked
    const current = get().playlists.find((item) => item.id === id)
    if (!current) return { error: "Playlist not found." }
    const updated = optimisticAddSong(current, songNumber)
    const playlists = replacePlaylist(get().playlists, updated)
    set({ playlists, error: null })
    persistSoon(playlists)
    enqueuePlaylistSync({ type: "add", id, songNumber })
    return updated
  },

  removeSong: async (id, songNumber) => {
    const blocked = memberReady()
    if (blocked) return blocked
    const current = get().playlists.find((item) => item.id === id)
    if (!current) return { error: "Playlist not found." }
    const updated = optimisticRemoveSong(current, songNumber)
    const playlists = replacePlaylist(get().playlists, updated)
    set({ playlists, error: null })
    persistSoon(playlists)
    enqueuePlaylistSync({ type: "remove", id, songNumber })
    return updated
  },
}))

bindPlaylistSyncHandlers({
  onSyncing: (active) => usePlaylistStore.setState({ syncing: active }),
  onPlaylists: (playlists) => usePlaylistStore.setState({ playlists }),
  onError: (message) => usePlaylistStore.setState({ error: message, syncing: false }),
  readPlaylists: () => usePlaylistStore.getState().playlists,
  onIdAssigned: (tempId, id) => usePlaylistCoverStore.getState().move(tempId, id),
})

/** Everything about playlists that the phone holds: the list, the cache on disk and the waiting changes. */
export async function clearPlaylistsOnDevice(): Promise<void> {
  resetPlaylistSyncQueue()
  usePlaylistStore.setState({ playlists: [], error: null, loading: false, syncing: false })
  usePlaylistCoverStore.getState().clear()
  await clearPlaylistCache()
}

// Another account, or none: the playlists on the phone are not for them. (Signing out calls the same.)
let playlistOwner = currentOwner()
if (typeof useAuthStore.subscribe === "function") {
  useAuthStore.subscribe(() => {
    const next = currentOwner()
    if (next === playlistOwner) return
    playlistOwner = next
    void clearPlaylistsOnDevice()
  })
}

export function isPlaylist(value: PlaylistResult): value is MemberPlaylist {
  return "id" in value && "songs" in value
}
