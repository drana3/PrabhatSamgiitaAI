import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { MOCK_SAVED } from "@/lib/fixtures/songsMock"

/**
 * Small state of the playlist-style Songs pages that has no home elsewhere:
 * - `hidden`: songs the listener removed from a list ("Hide from this list"), per list id. Kept on
 *   the phone; the list menu brings them back.
 * - `mockSaved`: hearts of the web preview (MOCKUP_DATA), because the preview has no account.
 */
type ListState = {
  hidden: Record<string, number[]>
  mockSaved: number[]
  hide: (listId: string, number: number) => void
  unhideAll: (listId: string) => void
  toggleMockSaved: (number: number) => boolean
}

export const useSongsListState = create<ListState>()(
  persist(
    (set, get) => ({
      hidden: {},
      mockSaved: [...MOCK_SAVED],
      hide: (listId, number) => {
        const current = get().hidden[listId] ?? []
        if (current.includes(number)) return
        set({ hidden: { ...get().hidden, [listId]: [...current, number] } })
      },
      unhideAll: (listId) => {
        const { [listId]: _gone, ...rest } = get().hidden
        set({ hidden: rest })
      },
      toggleMockSaved: (number) => {
        const has = get().mockSaved.includes(number)
        set({ mockSaved: has ? get().mockSaved.filter((n) => n !== number) : [...get().mockSaved, number] })
        return !has
      },
    }),
    {
      name: "prabhat-songs-v2-lists",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ hidden: state.hidden }),
    },
  ),
)
