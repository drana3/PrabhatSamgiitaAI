import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { DEFAULT_ROW_STYLE, normalizeRowStyle, type RowStyle } from "@/lib/songsV2/rowStyles"

type ListViewState = {
  /** how song rows are drawn: Tracklist (default), Compact or Cards */
  rowStyle: RowStyle
  setRowStyle: (value: RowStyle) => void
}

/**
 * Version 3 drops a Rows choice saved before Dada picked Tracklist from the three looks side by side (the builds
 * before stored Compact as the default), so every phone starts on the chosen look. From here on a saved choice is kept.
 */
export function migrateListView(): { rowStyle: RowStyle } {
  return { rowStyle: DEFAULT_ROW_STYLE }
}

/** The "Rows" setting of the song lists, kept per device. */
export const useListViewStore = create<ListViewState>()(
  persist(
    (set) => ({
      rowStyle: DEFAULT_ROW_STYLE,
      setRowStyle: (value) => set({ rowStyle: normalizeRowStyle(value) }),
    }),
    {
      name: "prabhat-list-view",
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: migrateListView,
      partialize: (state) => ({ rowStyle: state.rowStyle }),
      merge: (persisted, current) => ({
        ...current,
        rowStyle: normalizeRowStyle((persisted as Partial<ListViewState> | undefined)?.rowStyle),
      }),
    },
  ),
)
