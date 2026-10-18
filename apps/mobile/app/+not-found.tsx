import { useRouter } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { href } from "@/utils/href"

/** Visible recovery UI — never auto-redirect (avoids blank-screen loops). */
export default function NotFound() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.subtitle}>This link is not part of the app. Head home to continue.</Text>
        <PrimaryButton label="Go home" onPress={() => router.replace(href("/(tabs)"))} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
})
