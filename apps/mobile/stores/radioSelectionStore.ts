import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  DEFAULT_RADIO_SELECTION,
  LEGACY_DEFAULT_SELECTION,
  RADIO_SELECTION_VERSION,
  selectAll,
  toggleCategory,
  sanitizeSelection,
  type RadioCategory,
  type RadioCounts,
  type ToggleResult,
} from "@/lib/radio/categories"

/**
 * Which categories the Radio plays from, remembered between sessions on this phone (nothing is sent anywhere).
 * Persist version = RADIO_SELECTION_VERSION (lib/radio/categories.ts): bump it when the ids or the meaning of the stored
 * value change; `migrate` keeps whatever still reads as a known category and never leaves the list empty.
 * The rules of a tap (the last tick stays, an empty category cannot be chosen) are pure functions in lib/radio/categories.ts.
 */
type RadioSelectionState = {
  selected: RadioCategory[]
  /** One tap on a chip. The result tells the screen whether to show the gentle "at least one" hint. */
  toggle: (id: RadioCategory, counts: RadioCounts) => ToggleResult
  /** The "All" shortcut. */
  chooseAll: (counts: RadioCounts) => void
  /** Replace the whole choice (a deep link, a test). */
  setSelected: (selected: readonly RadioCategory[]) => void
  reset: () => void
}

export const useRadioSelectionStore = create<RadioSelectionState>()(
  persist(
    (set, get) => ({
      selected: [...DEFAULT_RADIO_SELECTION],
      toggle: (id, counts) => {
        const { selected, result } = toggleCategory(get().selected, id, counts)
        if (result === "added" || result === "removed") set({ selected })
        return result
      },
      chooseAll: (counts) => set({ selected: selectAll(counts) }),
      setSelected: (selected) => set({ selected: sanitizeSelection(selected) }),
      reset: () => set({ selected: [...DEFAULT_RADIO_SELECTION] }),
    }),
    {
      name: "prabhat-radio-selection",
      storage: createJSONStorage(() => AsyncStorage),
      version: RADIO_SELECTION_VERSION,
      partialize: (state) => ({ selected: state.selected }),
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as { selected?: unknown }
        const kept = sanitizeSelection(old.selected)
        // version 1 stored "Prabhat Samgiita only" as its default: nobody chose that, the new default is all categories
        const wasDefault = version < 2 && kept.length === LEGACY_DEFAULT_SELECTION.length && kept.every((c) => LEGACY_DEFAULT_SELECTION.includes(c))
        return { selected: wasDefault ? [...DEFAULT_RADIO_SELECTION] : kept }
      },
    },
  ),
)
