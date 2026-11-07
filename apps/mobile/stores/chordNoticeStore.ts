import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { EMPTY_SEEN, type Seen } from "@/lib/songChords/notices"
import { retireTestData } from "@/lib/songChords/retireTestData"

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
      // v2: starts from nothing seen, so the first look only records (no notice for old test charts)
      name: "prabhat-chord-notices-v2",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({ statuses: s.statuses }),
    },
  ),
)

// once per start: remove the retired keys of the first test versions (and their notices from the inbox)
void retireTestData()
