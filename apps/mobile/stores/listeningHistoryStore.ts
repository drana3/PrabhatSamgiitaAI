import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { addEntry, removeEntry, sanitizeHistory, type HistoryEntry } from "@/lib/listening/history"

/**
 * My listening history (lib/listening/history.ts): the tracks this person really listened to, on this phone only.
 * Nothing is sent to the server and nothing is read from it. `paused` stops new entries (what is there stays until
 * removed). Persist version 1: bump it when the shape of an entry changes or the preview's demo data is renewed, so
 * old test data does not linger (`migrate` keeps what still reads as an entry).
 */
type ListeningHistoryState = {
  entries: HistoryEntry[]
  paused: boolean
  /** Add a counted play. Ignored while paused. */
  add: (entry: HistoryEntry) => void
  remove: (id: string) => void
  clear: () => void
  setPaused: (paused: boolean) => void
}

export const LISTENING_HISTORY_STORE_VERSION = 1

export const useListeningHistoryStore = create<ListeningHistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      paused: false,
      add: (entry) => {
        if (get().paused) return
        set({ entries: addEntry(get().entries, entry) })
      },
      remove: (id) => set({ entries: removeEntry(get().entries, id) }),
      clear: () => set({ entries: [] }),
      setPaused: (paused) => set({ paused }),
    }),
    {
      name: "prabhat-listening-history",
      storage: createJSONStorage(() => AsyncStorage),
      version: LISTENING_HISTORY_STORE_VERSION,
      partialize: (state) => ({ entries: state.entries, paused: state.paused }),
      migrate: (persisted) => {
        const old = (persisted ?? {}) as { entries?: unknown; paused?: unknown }
        return { entries: sanitizeHistory(old.entries), paused: old.paused === true }
      },
    },
  ),
)
