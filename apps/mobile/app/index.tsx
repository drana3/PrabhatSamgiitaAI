import { Redirect } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { colors } from "@/constants/colors"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

export default function Index() {
  const hasCompletedWelcome = useAuthStore((s) => s.hasCompletedWelcome)
  const [ready, setReady] = useState(() => useAuthStore.persist.hasHydrated())

  useEffect(() => {
    setReady(useAuthStore.persist.hasHydrated())
    return useAuthStore.persist.onFinishHydration(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  if (!hasCompletedWelcome) {
    return <Redirect href={href("/welcome")} />
  }

  // Always open on Home — never restore a previous tab.
  return <Redirect href={href("/(tabs)")} />
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
})
