import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "expo-router"

import { authErrorMessage } from "@/lib/auth/signInFlow"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { afterOnboardingSignIn, type SignInStepResult } from "@/lib/onboarding/flow"
import { useAuthStore } from "@/stores/authStore"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { href } from "@/utils/href"

export type SignInAction = "apple" | "google" | "email"

/**
 * The sign-in half of the onboarding screens: runs one sign-in call, shows its error in plain words,
 * and moves on. The calls themselves (lib/session.ts) are the same ones the Sign in page uses.
 *
 * - A person who closes the Apple or Google window gets no error (that is not a failure).
 * - A phone number is never asked for here, whatever the server says; a missing name can be set later
 *   in Profile > Edit profile.
 * - Preview only (EXPO_PUBLIC_MOCKUP_DATA=1): nothing real is called, the call ends in a quiet error.
 */
export function useOnboardingSignIn(returning: boolean, initial?: { action: SignInAction; text: string } | null) {
  const t = useT()
  const router = useRouter()
  const goTo = useOnboardingStore((s) => s.goTo)

  const [busy, setBusy] = useState<SignInAction | null>(null)
  const [error, setError] = useState<{ action: SignInAction; text: string } | null>(initial ?? null)
  const lastRun = useRef<(() => void) | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /** Signed in (or about to be): go to step 3, or to "Your songs are back" for a returning person. */
  const proceed = useCallback(() => {
    const next = afterOnboardingSignIn(returning)
    if (next.step === "inside") goTo("inside")
    router.replace(href(next.route))
  }, [goTo, returning, router])

  const run = useCallback(
    async (action: SignInAction, task: () => Promise<SignInStepResult>) => {
      lastRun.current = () => void run(action, task)
      setBusy(action)
      setError(null)
      try {
        if (MOCKUP_DATA) {
          await new Promise((resolve) => setTimeout(resolve, 900))
          throw new Error(action === "email" ? t("account.error.badCredentials") : t("account.error.previewOff"))
        }
        await task()
        proceed()
      } catch (failure) {
        if (!alive.current) return
        const text = authErrorMessage(failure)
        setError(text ? { action, text } : null)
      } finally {
        if (alive.current) setBusy(null)
      }
    },
    [proceed, t],
  )

  const retry = useCallback(() => (lastRun.current ? lastRun.current() : setError(null)), [])

  /** Continue as a guest: nothing is created, the person goes on to step 3. */
  const continueAsGuest = useCallback(() => {
    useAuthStore.getState().setMode("guest")
    goTo("inside")
    router.replace(href("/onboarding/inside"))
  }, [goTo, router])

  return { busy, error, setError, run, retry, proceed, continueAsGuest }
}
