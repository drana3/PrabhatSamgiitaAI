import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { Draft } from "@/lib/songChords/draft"

/**
 * The chart a member is working on, kept on the device so that leaving the screen (a phone call, the back button, a
 * crash) does not lose half an hour of chords. One draft at a time; it is cleared when the chart is sent.
 */
type ChordDraftState = {
  draft: Draft | null
  setDraft: (draft: Draft | null) => void
}

export const useChordDraftStore = create<ChordDraftState>()(
  persist(
    (set) => ({
      draft: null,
      setDraft: (draft) => set({ draft }),
    }),
    {
      name: "prabhat-chord-draft-v1",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({ draft: s.draft }),
    },
  ),
)
