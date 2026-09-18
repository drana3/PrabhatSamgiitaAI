import { useRouter } from "expo-router"
import { useEffect } from "react"
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native"

import { colors } from "@/constants/colors"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

export default function Index() {
  const router = useRouter()
  const hasCompletedWelcome = useAuthStore((s) => s.hasCompletedWelcome)

  useEffect(() => {
    const target = hasCompletedWelcome ? href("/(tabs)") : href("/welcome")
    // Redirect during the first native frame can close the app on Android cold start.
    const navigate = () => router.replace(target)
    if (Platform.OS === "android") {
      const frame = requestAnimationFrame(() => {
        setTimeout(navigate, 0)
      })
      return () => cancelAnimationFrame(frame)
    }
    navigate()
  }, [hasCompletedWelcome, router])

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
