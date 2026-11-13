import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export const LOUDNESS_STORE_VERSION = 1

/** Volume leveling is on until the listener turns it off (the whole point is that nobody has to ask for it). */
export const DEFAULT_LEVELING_ENABLED = true

type LoudnessStoreState = {
  /** The "Volume leveling" switch in the profile settings. */
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

/** Anything but a stored `false` means on, so a damaged or old payload never silently turns it off. */
export function normalizeLevelingEnabled(value: unknown): boolean {
  return value === false ? false : DEFAULT_LEVELING_ENABLED
}

export const useLoudnessStore = create<LoudnessStoreState>()(
  persist(
    (set) => ({
      enabled: DEFAULT_LEVELING_ENABLED,
      setEnabled: (enabled) => set({ enabled: normalizeLevelingEnabled(enabled) }),
    }),
    {
      name: "ps-loudness-v1",
      version: LOUDNESS_STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ enabled: state.enabled }),
      merge: (persisted, current) => ({
        ...current,
        enabled: normalizeLevelingEnabled((persisted as { enabled?: unknown } | null)?.enabled),
      }),
    },
  ),
)

/** Read outside React (the player). */
export function isLevelingEnabled(): boolean {
  return useLoudnessStore.getState().enabled
}
