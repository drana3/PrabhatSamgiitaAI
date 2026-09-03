import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { favoritesScopeKey } from "@/lib/favoritesScope"
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
  favoritesScope: string
  favoritesByScope: Record<string, string[]>
  savedSongIds: string[]
  recentPlays: RecentPlay[]
  searchRecents: string[]
  feelingSearchEnabled: boolean
  songNotes: Record<string, string>
  syncingFavorites: boolean
  activateFavoritesScope: (scope: string) => void
  setSavedFromNumbers: (numbers: number[]) => void
  toggleSaved: (songId: string) => Promise<{ needsAuth: boolean }>
  resetAfterSignOut: () => void
  hydrateFavoritesFromServer: () => Promise<void>
  recordRecentPlay: (
    song: Pick<MockSong, "id" | "number" | "title" | "thumbnailUrl" | "themes">,
  ) => void
  addSearchRecent: (query: string) => void
  clearSearchRecents: () => void
  setFeelingSearchEnabled: (enabled: boolean) => void
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

function currentAuthScope() {
  const { mode, memberId, identityProvider, email } = useAuthStore.getState()
  return favoritesScopeKey({ mode, memberId, identityProvider, email })
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      favoritesScope: "guest",
      favoritesByScope: {},
      savedSongIds: [],
      recentPlays: [],
      searchRecents: [],
      feelingSearchEnabled: false,
      songNotes: {},
      syncingFavorites: false,

      activateFavoritesScope: (scope) => {
        const current = get().favoritesScope
        if (current === scope) return
        const favoritesByScope = { ...get().favoritesByScope, [current]: get().savedSongIds }
        set({
          favoritesScope: scope,
          favoritesByScope,
          savedSongIds: favoritesByScope[scope] ?? [],
        })
      },

      setSavedFromNumbers: (numbers) => {
        const savedSongIds = numbers.map(toSongId)
        const scope = get().favoritesScope
        set({
          savedSongIds,
          favoritesByScope: { ...get().favoritesByScope, [scope]: savedSongIds },
        })
      },

      hydrateFavoritesFromServer: async () => {
        const { mode } = useAuthStore.getState()
        if (mode !== "signed_in" || !memberAuthAvailable()) return
        set({ syncingFavorites: true })
        try {
          const remote = await api.fetchMemberFavorites()
          if (remote === null) return
          const scope = get().favoritesScope
          const localNumbers = (get().favoritesByScope[scope] ?? get().savedSongIds)
            .map(toSongNumber)
            .filter((n): n is number => n != null)
          const merged = [...new Set([...remote, ...localNumbers])]
          const savedSongIds = merged.map(toSongId)
          set({
            savedSongIds,
            favoritesByScope: { ...get().favoritesByScope, [scope]: savedSongIds },
          })
          for (const number of localNumbers) {
            if (remote.includes(number)) continue
            try {
              const next = await api.addMemberFavorite(number)
              const synced = next.map(toSongId)
              set({
                savedSongIds: synced,
                favoritesByScope: { ...get().favoritesByScope, [scope]: synced },
              })
            } catch {
              // Keep merged local list if upload fails.
            }
          }
        } finally {
          set({ syncingFavorites: false })
        }
      },

      toggleSaved: async (songId) => {
        const { mode } = useAuthStore.getState()
        if (mode !== "signed_in") {
          return { needsAuth: true }
        }

        const existing = get().savedSongIds
        const isSaved = existing.includes(songId)
        const optimistic = isSaved
          ? existing.filter((id) => id !== songId)
          : [...existing, songId]
        const scope = get().favoritesScope
        set({
          savedSongIds: optimistic,
          favoritesByScope: { ...get().favoritesByScope, [scope]: optimistic },
        })

        const number = toSongNumber(songId)
        if (!memberAuthAvailable() || !number) return { needsAuth: false }

        try {
          const numbers = isSaved
            ? await api.removeMemberFavorite(number)
            : await api.addMemberFavorite(number)
          const savedSongIds = numbers.map(toSongId)
          set({
            savedSongIds,
            favoritesByScope: { ...get().favoritesByScope, [scope]: savedSongIds },
          })
        } catch {
          // Keep optimistic local state if member backend is unavailable.
        }
        return { needsAuth: false }
      },

      resetAfterSignOut: () => {
        const favoritesByScope = { ...get().favoritesByScope, guest: [] as string[] }
        set({
          feelingSearchEnabled: false,
          favoritesScope: "guest",
          savedSongIds: [],
          favoritesByScope,
        })
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
        if (trimmed.length < 2 && !/^\s*(?:ps[\s-]*)?\d{1,4}\s*$/i.test(trimmed)) return
        const rest = get().searchRecents.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())
        set({ searchRecents: [trimmed, ...rest].slice(0, 8) })
      },

      clearSearchRecents: () => set({ searchRecents: [] }),
      setFeelingSearchEnabled: (enabled) => set({ feelingSearchEnabled: enabled }),

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
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as {
          savedSongIds?: string[]
          favoritesByScope?: Record<string, string[]>
          favoritesScope?: string
          recentPlays?: RecentPlay[]
          searchRecents?: string[]
          songNotes?: Record<string, string>
        }
        if (version < 2) {
          const legacySaved = state.savedSongIds ?? []
          return {
            ...state,
            favoritesScope: state.favoritesScope ?? "guest",
            favoritesByScope: {
              ...(state.favoritesByScope ?? {}),
              guest: state.favoritesByScope?.guest ?? legacySaved,
            },
            savedSongIds: legacySaved,
          }
        }
        return state
      },
      partialize: (state) => ({
        favoritesScope: state.favoritesScope,
        favoritesByScope: state.favoritesByScope,
        savedSongIds: state.savedSongIds,
        recentPlays: state.recentPlays,
        searchRecents: state.searchRecents,
        feelingSearchEnabled: state.feelingSearchEnabled,
        songNotes: state.songNotes,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const scope = currentAuthScope()
        const favoritesByScope = { ...(state.favoritesByScope ?? {}) }
        if (state.savedSongIds.length && !favoritesByScope[scope]?.length) {
          favoritesByScope[scope] = state.savedSongIds
        }
        state.favoritesByScope = favoritesByScope
        state.activateFavoritesScope(scope)
      },
    },
  ),
)

useAuthStore.subscribe((state, previous) => {
  if (
    state.mode === previous.mode &&
    state.memberId === previous.memberId &&
    state.identityProvider === previous.identityProvider &&
    state.email === previous.email
  ) {
    return
  }
  usePreferencesStore.getState().activateFavoritesScope(
    favoritesScopeKey({
      mode: state.mode,
      memberId: state.memberId,
      identityProvider: state.identityProvider,
      email: state.email,
    }),
  )
})
