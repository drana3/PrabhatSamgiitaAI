import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native"
import { useRouter } from "expo-router"
import {
  FEELING_ENABLE_IN_PROFILE_BODY,
  FEELING_ENABLE_IN_PROFILE_TITLE,
  FEELING_SEARCH_HINT_GUEST,
  FEELING_SEARCH_HINT_SIGNED_IN,
} from "@prabhat/core"

import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

type Props = {
  /**
   * `manage` — Profile: toggle Feeling search directly (visible switch).
   * `redirect` — Explore: turn off locally, or send members to Profile to enable.
   */
  mode?: "manage" | "redirect"
}

/** Feeling search preference control — same behavior as website account toggle. */
export function FeelingSearchSwitch({ mode = "redirect" }: Props) {
  const router = useRouter()
  const signedIn = useAuthStore((s) => s.mode === "signed_in")
  const feelingSearchEnabled = usePreferencesStore((s) => s.feelingSearchEnabled)
  const setFeelingSearchEnabled = usePreferencesStore((s) => s.setFeelingSearchEnabled)
  const on = signedIn && feelingSearchEnabled

  const setEnabled = (next: boolean) => {
    if (!signedIn) {
      router.push(href("/signin"))
      return
    }
    if (mode === "redirect" && next) {
      Alert.alert(FEELING_ENABLE_IN_PROFILE_TITLE, FEELING_ENABLE_IN_PROFILE_BODY, [
        { text: "Not now", style: "cancel" },
        { text: "Open Profile", onPress: () => router.push(href("/(tabs)/profile")) },
      ])
      return
    }
    setFeelingSearchEnabled(next)
  }

  const onPressCopy = () => {
    if (!signedIn) {
      router.push(href("/signin"))
      return
    }
    if (mode === "manage") {
      setFeelingSearchEnabled(!feelingSearchEnabled)
      return
    }
    if (on) {
      setFeelingSearchEnabled(false)
      return
    }
    Alert.alert(FEELING_ENABLE_IN_PROFILE_TITLE, FEELING_ENABLE_IN_PROFILE_BODY, [
      { text: "Not now", style: "cancel" },
      { text: "Open Profile", onPress: () => router.push(href("/(tabs)/profile")) },
    ])
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Feeling search"
        onPress={onPressCopy}
        style={styles.copy}
      >
        <Text style={styles.title}>Feeling search</Text>
        <Text style={styles.hint}>
          {signedIn ? FEELING_SEARCH_HINT_SIGNED_IN : FEELING_SEARCH_HINT_GUEST}
        </Text>
        {mode === "manage" ? (
          <Text style={styles.state} accessibilityLiveRegion="polite">
            {on ? "On" : "Off"}
          </Text>
        ) : null}
      </Pressable>
      <Switch
        accessibilityLabel="Feeling search"
        accessibilityState={{ checked: on }}
        value={on}
        onValueChange={setEnabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.border}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textPrimary,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
  state: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    lineHeight: 16,
    color: colors.primaryDark,
    marginTop: spacing.xs,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  },
})
