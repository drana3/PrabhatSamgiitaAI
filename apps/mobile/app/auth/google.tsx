import { useEffect } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { colors } from "@/constants/colors"
import { href } from "@/utils/href"

/** Sink for Google OAuth deep links (`prabhatai://auth/google`). */
export default function GoogleAuthCallbackRoute() {
  const router = useRouter()

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      router.replace(href("/"))
    })
    return () => cancelAnimationFrame(id)
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
