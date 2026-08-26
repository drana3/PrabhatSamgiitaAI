import { Alert, Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import {
  HARMONIUM_GATE_ACTION_GUEST,
  HARMONIUM_GATE_ACTION_PROFILE,
  HARMONIUM_GATE_BODY_GUEST,
  HARMONIUM_GATE_BODY_SIGNED_IN,
  HARMONIUM_GATE_TITLE,
} from "@prabhat/core"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

export function HarmoniumPracticeGate() {
  const router = useRouter()
  const signedIn = useAuthStore((state) => state.mode === "signed_in")

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Optional learning studio</Text>
      <Text style={styles.title}>{HARMONIUM_GATE_TITLE}</Text>
      <Text style={styles.body}>{signedIn ? HARMONIUM_GATE_BODY_SIGNED_IN : HARMONIUM_GATE_BODY_GUEST}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (signedIn) {
            router.push(href("/(tabs)/profile"))
            return
          }
          router.push(href("/signin"))
        }}
        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.primaryBtnText}>
          {signedIn ? HARMONIUM_GATE_ACTION_PROFILE : HARMONIUM_GATE_ACTION_GUEST}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (!signedIn) {
            router.push(href("/signin"))
            return
          }
          Alert.alert(
            HARMONIUM_GATE_TITLE,
            "Open Profile, then turn on Harmonium practice under Preferences.",
          )
        }}
        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.secondaryBtnText}>Learn more</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontFamily: "Inter_600SemiBold",
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    fontFamily: "SourceSerif4_600SemiBold",
  },
  body: { ...typography.bodySmall, color: colors.textSecondary },
  primaryBtn: {
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  primaryBtnText: { ...typography.label, color: colors.white, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  secondaryBtnText: { ...typography.label, color: colors.textPrimary, fontFamily: "Inter_600SemiBold" },
})
