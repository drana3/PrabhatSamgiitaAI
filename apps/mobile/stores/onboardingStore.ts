import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { normalizeStoredStep, type OnboardingStep, type StoredStep } from "@/lib/onboarding/flow"

type OnboardingState = {
  /** The step the person is on, so an app closed in the middle opens on it. `done` after the end. */
  step: StoredStep
  /** The person came in through "I have an account": after sign-in they see "Your songs are back", not step 3. */
  returning: boolean
  /** The one-time Kiirtan hint is waiting for the first visit to the Kiirtan tab. */
  kiirtanHintPending: boolean
  /** The hint was shown and closed; it never comes back. */
  kiirtanHintSeen: boolean
  goTo: (step: OnboardingStep) => void
  setReturning: (value: boolean) => void
  /** The end of the onboarding (step 3 Continue, or "Your songs are back" Continue). */
  finish: () => void
  dismissKiirtanHint: () => void
}

/**
 * Where the person is in the first-run onboarding (docs/onboarding.md). Persisted under
 * `prabhat-onboarding`. Whether the onboarding runs at all is NOT decided here but by
 * `authStore.hasCompletedWelcome`, which stays the one "welcome is finished" flag: a person who set it
 * under the old welcome screen never sees the onboarding.
 */
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      step: "welcome",
      returning: false,
      kiirtanHintPending: false,
      kiirtanHintSeen: false,
      goTo: (step) => set({ step }),
      setReturning: (value) => set({ returning: value }),
      finish: () => set({ step: "done", returning: false, kiirtanHintPending: !get().kiirtanHintSeen }),
      dismissKiirtanHint: () => set({ kiirtanHintPending: false, kiirtanHintSeen: true }),
    }),
    {
      name: "prabhat-onboarding",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        step: state.step,
        returning: state.returning,
        kiirtanHintPending: state.kiirtanHintPending,
        kiirtanHintSeen: state.kiirtanHintSeen,
      }),
      merge: (persisted, current) => {
        const source = (persisted && typeof persisted === "object" ? persisted : {}) as Record<string, unknown>
        return {
          ...current,
          step: normalizeStoredStep(source.step),
          returning: source.returning === true,
          kiirtanHintPending: source.kiirtanHintPending === true,
          kiirtanHintSeen: source.kiirtanHintSeen === true,
        }
      },
    },
  ),
)
