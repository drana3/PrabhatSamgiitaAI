import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native"

import { colors } from "@/constants/colors"
import { entryRoute } from "@/lib/onboarding/flow"
import { useAuthStore } from "@/stores/authStore"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { href } from "@/utils/href"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"

export default function Index() {
  const router = useRouter()
  const hasCompletedWelcome = useAuthStore((s) => s.hasCompletedWelcome)
  const step = useOnboardingStore((s) => s.step)
  // The step the onboarding stopped on is read from the phone before the first redirect.
  const [stepReady, setStepReady] = useState(() => useOnboardingStore.persist.hasHydrated())
  useEffect(() => {
    if (useOnboardingStore.persist.hasHydrated()) setStepReady(true)
    return useOnboardingStore.persist.onFinishHydration(() => setStepReady(true))
  }, [])

  useEffect(() => {
    // A person who finished the welcome before goes straight in; a new one opens on the step they stopped at.
    if (!stepReady && !hasCompletedWelcome) return
    const entry = entryRoute({ hasCompletedWelcome, step })
    const target = entry.to === "app" ? href(NAV_V2_HOME_ROUTE) : href(entry.route)
    // Redirect during the first native frame can close the app on Android cold start.
    const navigate = () => router.replace(target)
    if (Platform.OS === "android") {
      const frame = requestAnimationFrame(() => {
        setTimeout(navigate, 0)
      })
      return () => cancelAnimationFrame(frame)
    }
    navigate()
  }, [hasCompletedWelcome, router, step, stepReady])

  return (
    <View style={styles.boot}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  )
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
})
