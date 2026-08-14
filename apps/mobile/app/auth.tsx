import { useEffect } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { colors } from "@/constants/colors"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

/**
 * Sink for Microsoft auth deep links (`prabhatai://auth`).
 * Wait for expo-auth-session + sign-in to finish before routing away.
 */
export default function AuthCallbackRoute() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const started = Date.now()
    const maxWaitMs = 5000

    const finish = () => {
      if (cancelled) return
      const { mode, hasCompletedWelcome } = useAuthStore.getState()
      if (mode === "signed_in") {
        if (!hasCompletedWelcome) {
          useAuthStore.getState().completeWelcome()
        }
        router.replace(href("/(tabs)"))
        return
      }
      if (Date.now() - started < maxWaitMs) {
        requestAnimationFrame(finish)
        return
      }
      router.replace(href("/signin"))
    }

    const id = requestAnimationFrame(finish)
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [router])

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
