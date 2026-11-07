import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { MenuMemory } from "@/lib/searchMenu/types"

/**
 * What the Search menu remembers between opens so a shelf does not blink at its threshold (docs/search-menu.md, 2.4),
 * and the team's pins as last read from the server (the menu works offline with the last list). Device only.
 * Persist version 1.
 */
type SearchMenuState = {
  memory: MenuMemory
  pins: string[]
  /** ms since epoch of the last successful pins read */
  pinsAt: number
  setMemory: (memory: MenuMemory) => void
  setPins: (pins: string[], at: number) => void
}

export const SEARCH_MENU_STORE_VERSION = 1

const empty = (): MenuMemory => ({ shown: {}, order: [] })

function validMemory(raw: unknown): MenuMemory {
  const m = raw as Partial<MenuMemory> | undefined
  if (!m || typeof m.shown !== "object" || !m.shown || !Array.isArray(m.order)) return empty()
  const shown: Record<string, number> = {}
  for (const [id, at] of Object.entries(m.shown)) if (typeof at === "number" && Number.isFinite(at)) shown[id] = at
  return { shown, order: m.order.filter((id): id is string => typeof id === "string") }
}

export const useSearchMenuStore = create<SearchMenuState>()(
  persist(
    (set) => ({
      memory: empty(),
      pins: [],
      pinsAt: 0,
      setMemory: (memory) => set({ memory }),
      setPins: (pins, at) => set({ pins, pinsAt: at }),
    }),
    {
      name: "prabhat-search-menu",
      storage: createJSONStorage(() => AsyncStorage),
      version: SEARCH_MENU_STORE_VERSION,
      partialize: (state) => ({ memory: state.memory, pins: state.pins, pinsAt: state.pinsAt }),
      migrate: (persisted) => {
        const old = (persisted ?? {}) as { memory?: unknown; pins?: unknown; pinsAt?: unknown }
        return {
          memory: validMemory(old.memory),
          pins: Array.isArray(old.pins) ? old.pins.filter((p): p is string => typeof p === "string") : [],
          pinsAt: typeof old.pinsAt === "number" ? old.pinsAt : 0,
        }
      },
    },
  ),
)
