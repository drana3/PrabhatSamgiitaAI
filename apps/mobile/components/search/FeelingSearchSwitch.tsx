import { Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

/** Same Feeling search control on Home and Explore. */
export function FeelingSearchSwitch() {
  const router = useRouter()
  const signedIn = useAuthStore((s) => s.mode === "signed_in")
  const feelingSearchEnabled = usePreferencesStore((s) => s.feelingSearchEnabled)
  const setFeelingSearchEnabled = usePreferencesStore((s) => s.setFeelingSearchEnabled)
  const on = signedIn && feelingSearchEnabled

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="Feeling search"
      onPress={() => {
        if (!signedIn) {
          router.push(href("/signin"))
          return
        }
        setFeelingSearchEnabled(!feelingSearchEnabled)
      }}
      style={styles.row}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>Feeling search</Text>
        <Text style={styles.hint}>
          {signedIn
            ? "When on, mood searches use meaning. Lyrics stay on this device."
            : "Sign in to search songs by feeling."}
        </Text>
      </View>
      <View style={[styles.track, on && styles.trackOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { ...typography.caption, color: colors.textPrimary, fontWeight: "700" },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  trackOn: { backgroundColor: colors.primary },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
  },
  knobOn: { alignSelf: "flex-end" },
})
