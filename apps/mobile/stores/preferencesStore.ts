import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { useAuthStore } from "@/stores/authStore"

export type RecentPlay = {
  id: string
  number: number
  title: string
  thumbnailUrl: string
  themes: string[]
}

const MAX_RECENT = 12

type PreferencesState = {
  savedSongIds: string[]
  recentPlays: RecentPlay[]
  searchRecents: string[]
  songNotes: Record<string, string>
  syncingFavorites: boolean
  setSavedFromNumbers: (numbers: number[]) => void
  toggleSaved: (songId: string) => Promise<void>
  hydrateFavoritesFromServer: () => Promise<void>
  recordRecentPlay: (
    song: Pick<MockSong, "id" | "number" | "title" | "thumbnailUrl" | "themes">,
  ) => void
  addSearchRecent: (query: string) => void
  clearSearchRecents: () => void
  setSongNote: (songId: string, note: string) => void
}

function toSongId(number: number) {
  return `ps-${number}`
}

function toSongNumber(songId: string): number | null {
  const match = /^ps-(\d+)$/i.exec(songId)
  if (!match) return null
  const number = Number(match[1])
  return Number.isFinite(number) ? number : null
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      savedSongIds: [],
      recentPlays: [],
      searchRecents: [],
      songNotes: {},
      syncingFavorites: false,

      setSavedFromNumbers: (numbers) => {
        set({ savedSongIds: numbers.map(toSongId) })
      },

      hydrateFavoritesFromServer: async () => {
        const { mode } = useAuthStore.getState()
        if (mode !== "signed_in" || !memberAuthAvailable()) return
        set({ syncingFavorites: true })
        try {
          const remote = await api.fetchMemberFavorites()
          // Keep device favorites if the member API is unreachable.
          if (remote === null) return
          const localNumbers = get()
            .savedSongIds.map(toSongNumber)
            .filter((n): n is number => n != null)
          // Merge so a fresh empty account does not erase hearts saved on this device.
          const merged = [...new Set([...remote, ...localNumbers])]
          set({ savedSongIds: merged.map(toSongId) })
          // Push device-only favorites up so account sync catches up.
          for (const number of localNumbers) {
            if (remote.includes(number)) continue
            try {
              const next = await api.addMemberFavorite(number)
              set({ savedSongIds: next.map(toSongId) })
            } catch {
              // Keep merged local list if upload fails.
            }
          }
        } finally {
          set({ syncingFavorites: false })
        }
      },

      toggleSaved: async (songId) => {
        const existing = get().savedSongIds
        const isSaved = existing.includes(songId)
        const optimistic = isSaved
          ? existing.filter((id) => id !== songId)
          : [...existing, songId]
        set({ savedSongIds: optimistic })

        const { mode } = useAuthStore.getState()
        const number = toSongNumber(songId)
        if (mode !== "signed_in" || !memberAuthAvailable() || !number) return

        try {
          const numbers = isSaved
            ? await api.removeMemberFavorite(number)
            : await api.addMemberFavorite(number)
          set({ savedSongIds: numbers.map(toSongId) })
        } catch {
          // Keep optimistic local state if member backend is unavailable.
        }
      },

      recordRecentPlay: (song) => {
        const entry: RecentPlay = {
          id: song.id,
          number: song.number,
          title: song.title,
          thumbnailUrl: song.thumbnailUrl,
          themes: song.themes.slice(0, 3),
        }
        const rest = get().recentPlays.filter((item) => item.id !== entry.id)
        set({ recentPlays: [entry, ...rest].slice(0, MAX_RECENT) })
      },

      addSearchRecent: (query) => {
        const trimmed = query.trim()
        if (trimmed.length < 2) return
        const rest = get().searchRecents.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())
        set({ searchRecents: [trimmed, ...rest].slice(0, 8) })
      },

      clearSearchRecents: () => set({ searchRecents: [] }),

      setSongNote: (songId, note) => {
        const trimmed = note.trim()
        const next = { ...get().songNotes }
        if (!trimmed) delete next[songId]
        else next[songId] = note.slice(0, 2000)
        set({ songNotes: next })
      },
    }),
    {
      name: "prabhat-preferences",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        savedSongIds: state.savedSongIds,
        recentPlays: state.recentPlays,
        searchRecents: state.searchRecents,
        songNotes: state.songNotes,
      }),
    },
  ),
)
