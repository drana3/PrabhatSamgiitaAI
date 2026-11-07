import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { EMPTY_SEEN, type Seen } from "@/lib/songChords/notices"

/** What the phone last saw of the member's chord charts (lib/songChords/notices.ts): the base of "your chart was decided". */
type ChordNoticeState = Seen & {
  setSeen: (seen: Seen) => void
  reset: () => void
}

export const useChordNoticeStore = create<ChordNoticeState>()(
  persist(
    (set) => ({
      ...EMPTY_SEEN,
      setSeen: (seen) => set({ statuses: seen.statuses }),
      reset: () => set({ ...EMPTY_SEEN }),
    }),
    {
      name: "prabhat-chord-notices-v1",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({ statuses: s.statuses }),
    },
  ),
)
