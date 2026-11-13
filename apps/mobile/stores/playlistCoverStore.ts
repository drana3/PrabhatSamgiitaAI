import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { randomCover, resolveCover } from "@/lib/playlists/playlistCover"

/**
 * The cover photo number of each playlist, by playlist id, kept on this phone (the API playlist has no cover field; see
 * lib/playlists/playlistCover.ts). `assignRandom` runs when a playlist is made, so every new playlist gets its own photo
 * that then stays. A temporary id (`local-...`) is moved to the server id when the create is answered (`move`).
 * Everything here goes away with the playlists when the account changes (stores/playlistStore.ts clearPlaylistsOnDevice).
 */
type CoverState = {
  covers: Record<string, number>
  /** give a new playlist a random photo (different from `avoid`), unless it already has one */
  assignRandom: (id: string, avoid?: number | null, rng?: () => number) => number
  set: (id: string, photo: number) => void
  /** the playlist id changed (temporary to server id): the choice follows */
  move: (from: string, to: string) => void
  remove: (id: string) => void
  clear: () => void
}

/**
 * AsyncStorage, loaded lazily and never throwing: a unit test in plain node has no native storage (the web build of the
 * package reads `window`), and the store then simply stays in memory.
 */
const safeStorage = {
  getItem: async (key: string) => {
    try {
      return await require("@react-native-async-storage/async-storage").default.getItem(key)
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await require("@react-native-async-storage/async-storage").default.setItem(key, value)
    } catch {
      /* in memory only */
    }
  },
  removeItem: async (key: string) => {
    try {
      await require("@react-native-async-storage/async-storage").default.removeItem(key)
    } catch {
      /* in memory only */
    }
  },
}

export const usePlaylistCoverStore = create<CoverState>()(
  persist(
    (set, get) => ({
      covers: {},
      assignRandom: (id, avoid, rng) => {
        const existing = get().covers[id]
        if (existing != null) return existing
        const photo = randomCover(rng, avoid)
        set({ covers: { ...get().covers, [id]: photo } })
        return photo
      },
      set: (id, photo) => set({ covers: { ...get().covers, [id]: photo } }),
      move: (from, to) => {
        const covers = get().covers
        if (from === to || covers[from] == null) return
        const { [from]: photo, ...rest } = covers
        set({ covers: { ...rest, [to]: photo } })
      },
      remove: (id) => {
        const { [id]: _gone, ...rest } = get().covers
        set({ covers: rest })
      },
      clear: () => set({ covers: {} }),
    }),
    {
      name: "prabhat-playlist-covers",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ covers: state.covers }),
    },
  ),
)

/** The photo number a playlist wears right now: its stored choice, else the one derived from its id. */
export function usePlaylistCover(id: string): number {
  return usePlaylistCoverStore((s) => resolveCover(id, s.covers[id]))
}
