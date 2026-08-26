import { harmoniumPracticeActive } from "@prabhat/core"

import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

export function useHarmoniumPracticeEnabled(): boolean {
  const signedIn = useAuthStore((state) => state.mode === "signed_in")
  const enabled = usePreferencesStore((state) => state.harmoniumPracticeEnabled)
  return harmoniumPracticeActive(signedIn, enabled)
}
