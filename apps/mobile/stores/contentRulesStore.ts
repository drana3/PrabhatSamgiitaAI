import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { RULES_VERSION, type RulesAcceptance } from "@/lib/kirtan/rules"

type ContentRulesState = RulesAcceptance & {
  /** The person ticked "I agree to the content rules". Stores the time and the version of the rules. */
  accept: (now?: Date) => void
  reset: () => void
}

/**
 * Whether, and when, the person agreed to the content rules before uploading a Kiirtan or a Bhajan
 * (App Store 1.2 / Play UGC: users agree to terms before they post). On this phone, and sent with every upload
 * so the server keeps the time and the version as well.
 */
export const useContentRulesStore = create<ContentRulesState>()(
  persist(
    (set) => ({
      acceptedAt: null,
      version: null,
      accept: (now = new Date()) => set({ acceptedAt: now.toISOString(), version: RULES_VERSION }),
      reset: () => set({ acceptedAt: null, version: null }),
    }),
    {
      name: "prabhat-content-rules",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ acceptedAt: state.acceptedAt, version: state.version }),
    },
  ),
)
