import { useCallback } from "react"
import { useRouter } from "expo-router"

import { landingRoute } from "@/lib/onboarding/flow"
import { useAuthStore } from "@/stores/authStore"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { href } from "@/utils/href"

/**
 * The end of the onboarding: mark the welcome as done (so the app opens straight into the tabs from now on),
 * arm the one-time Kiirtan hint, and land on the Kiirtan tab. A person who never signed in stays a guest.
 */
export function useFinishOnboarding() {
  const router = useRouter()
  return useCallback(() => {
    useAuthStore.getState().completeWelcome()
    useOnboardingStore.getState().finish()
    router.replace(href(landingRoute()))
  }, [router])
}
