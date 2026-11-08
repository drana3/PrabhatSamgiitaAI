import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { AnalyticsMode } from "@/lib/analytics/client"

/**
 * What the person allows (Profile, Usage data). Default "anonymous": counts of what the app does,
 * no id of any kind. "shared" adds a random install id. "off" sends nothing, including crash reports.
 * Persisted under `prabhat-analytics`.
 */
export const DEFAULT_ANALYTICS_MODE: AnalyticsMode =
  // Apple App Review Guideline 5.1.1(ii) asks for consent to collect usage data even when anonymous
  // (docs/store-compliance.md). A store build can start from "off" with EXPO_PUBLIC_ANALYTICS_DEFAULT=off
  // until a first-launch ask exists; everything else starts anonymous, as Dada decided.
  process.env.EXPO_PUBLIC_ANALYTICS_DEFAULT === "off" ? "off" : "anonymous"

export function normalizeAnalyticsMode(value: unknown): AnalyticsMode {
  return value === "shared" || value === "off" || value === "anonymous" ? value : DEFAULT_ANALYTICS_MODE
}

type State = {
  mode: AnalyticsMode
  setMode: (mode: AnalyticsMode) => void
}

export const useAnalyticsConsentStore = create<State>()(
  persist(
    (set) => ({
      mode: DEFAULT_ANALYTICS_MODE,
      setMode: (mode) => set({ mode: normalizeAnalyticsMode(mode) }),
    }),
    {
      name: "prabhat-analytics",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ mode: state.mode }),
      merge: (persisted, current) => ({
        ...current,
        mode: normalizeAnalyticsMode((persisted as { mode?: unknown } | undefined)?.mode),
      }),
    },
  ),
)
