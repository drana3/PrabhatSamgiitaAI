import { useEffect } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"

import { colors } from "@/constants/colors"
import { href } from "@/utils/href"

/**
 * Sink for Microsoft auth deep links (`prabhatai://auth`).
 * Use replace (not Redirect) so we don't fight the initial URL matcher.
 */
export default function AuthCallbackRoute() {
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
