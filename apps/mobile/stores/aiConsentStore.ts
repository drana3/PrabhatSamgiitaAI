import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  AI_CONSENT_VERSION,
  isConsentValid,
  setAiConsentMirror,
  type AiConsentRecord,
} from "@/lib/aiConsent"

type AiConsentState = AiConsentRecord & {
  /** The person tapped Agree. Stores the time. */
  agree: (now?: Date) => void
  /** Taken back in Profile. The next question asks again. */
  revoke: () => void
}

/**
 * Whether, and when, the person agreed to send questions to the AI service (Azure OpenAI). On this phone only,
 * under its own key. Nothing is asked of the server for it.
 */
export const useAiConsentStore = create<AiConsentState>()(
  persist(
    (set) => ({
      agreedAt: null,
      version: 0,
      agree: (now = new Date()) => set({ agreedAt: now.toISOString(), version: AI_CONSENT_VERSION }),
      revoke: () => set({ agreedAt: null, version: 0 }),
    }),
    {
      name: "prabhat-ai-consent",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ agreedAt: state.agreedAt, version: state.version }),
      onRehydrateStorage: () => (state) => {
        setAiConsentMirror(isConsentValid(state))
      },
    },
  ),
)

useAiConsentStore.subscribe((state) => setAiConsentMirror(isConsentValid(state)))

/** Resolves once the saved answer has been read from storage, so a returning person is not asked again. */
export function aiConsentReady(): Promise<void> {
  if (useAiConsentStore.persist.hasHydrated()) return Promise.resolve()
  return new Promise((resolve) => {
    const stop = useAiConsentStore.persist.onFinishHydration(() => {
      stop()
      resolve()
    })
  })
}
