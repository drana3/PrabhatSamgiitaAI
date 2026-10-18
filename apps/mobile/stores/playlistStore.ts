import type { MemberPlaylist } from "@prabhat/core"
import { create } from "zustand"

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
      resetPlaylistSyncQueue()
      await clearPlaylistCache()
      set({ playlists: [], error: null, loading: false, syncing: false })
      return
    }
    const cached = peekPlaylistCache() ?? (await readPlaylistCache()) ?? []
    set({ playlists: cached, loading: false, error: null })
    const remote = await api.fetchMemberPlaylists()
    if (remote === null) {
      set((state) => ({
        loading: false,
        error: state.playlists.length ? null : "Could not load playlists.",
      }))
      return
    }
    await writePlaylistCache(remote)
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
})

export function isPlaylist(value: PlaylistResult): value is MemberPlaylist {
  return "id" in value && "songs" in value
}
