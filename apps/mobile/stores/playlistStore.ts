import type { MemberPlaylist } from "@prabhat/core"
import { create } from "zustand"

import { api } from "@/lib/client"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { useAuthStore } from "@/stores/authStore"

type PlaylistResult = MemberPlaylist | { needsAuth: true } | { error: string }

type PlaylistState = {
  playlists: MemberPlaylist[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createPlaylist: (name: string) => Promise<PlaylistResult>
  renamePlaylist: (id: string, name: string) => Promise<PlaylistResult>
  deletePlaylist: (id: string) => Promise<{ ok: true } | { needsAuth: true } | { error: string }>
  addSong: (id: string, songNumber: number) => Promise<PlaylistResult>
  removeSong: (id: string, songNumber: number) => Promise<PlaylistResult>
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

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  loading: false,
  error: null,

  refresh: async () => {
    if (!signedIn() || !memberAuthAvailable()) {
      set({ playlists: [], error: null })
      return
    }
    set({ loading: true, error: null })
    const remote = await api.fetchMemberPlaylists()
    if (remote === null) {
      set({ loading: false, error: "Could not load playlists." })
      return
    }
    set({ playlists: remote, loading: false, error: null })
  },

  createPlaylist: async (name) => {
    const blocked = memberReady()
    if (blocked) return blocked
    try {
      const created = await api.createMemberPlaylist(name)
      set({ playlists: [...get().playlists, created], error: null })
      return created
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create playlist."
      return { error: message }
    }
  },

  renamePlaylist: async (id, name) => {
    const blocked = memberReady()
    if (blocked) return blocked
    try {
      const updated = await api.renameMemberPlaylist(id, name)
      set({ playlists: replacePlaylist(get().playlists, updated) })
      return updated
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not rename playlist."
      return { error: message }
    }
  },

  deletePlaylist: async (id) => {
    const blocked = memberReady()
    if (blocked) return blocked
    try {
      await api.deleteMemberPlaylist(id)
      set({ playlists: get().playlists.filter((item) => item.id !== id) })
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete playlist."
      return { error: message }
    }
  },

  addSong: async (id, songNumber) => {
    const blocked = memberReady()
    if (blocked) return blocked
    try {
      const updated = await api.addMemberPlaylistSong(id, songNumber)
      set({ playlists: replacePlaylist(get().playlists, updated) })
      return updated
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add song."
      return { error: message }
    }
  },

  removeSong: async (id, songNumber) => {
    const blocked = memberReady()
    if (blocked) return blocked
    try {
      const updated = await api.removeMemberPlaylistSong(id, songNumber)
      set({ playlists: replacePlaylist(get().playlists, updated) })
      return updated
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove song."
      return { error: message }
    }
  },
}))

export function isPlaylist(value: PlaylistResult): value is MemberPlaylist {
  return "id" in value && "songs" in value
}
