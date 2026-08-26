import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native"
import { useRouter } from "expo-router"
import {
  HARMONIUM_ENABLE_IN_PROFILE_BODY,
  HARMONIUM_ENABLE_IN_PROFILE_TITLE,
  HARMONIUM_PRACTICE_HINT_GUEST,
  HARMONIUM_PRACTICE_HINT_SIGNED_IN,
} from "@prabhat/core"

import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

type Props = {
  mode?: "manage" | "redirect"
}

export function HarmoniumPracticeSwitch({ mode = "redirect" }: Props) {
  const router = useRouter()
  const signedIn = useAuthStore((state) => state.mode === "signed_in")
  const harmoniumPracticeEnabled = usePreferencesStore((state) => state.harmoniumPracticeEnabled)
  const setHarmoniumPracticeEnabled = usePreferencesStore((state) => state.setHarmoniumPracticeEnabled)
  const on = signedIn && harmoniumPracticeEnabled

  const setEnabled = (next: boolean) => {
    if (!signedIn) {
      router.push(href("/signin"))
      return
    }
    if (mode === "redirect" && next) {
      Alert.alert(HARMONIUM_ENABLE_IN_PROFILE_TITLE, HARMONIUM_ENABLE_IN_PROFILE_BODY, [
        { text: "Not now", style: "cancel" },
        { text: "Open Profile", onPress: () => router.push(href("/(tabs)/profile")) },
      ])
      return
    }
    setHarmoniumPracticeEnabled(next)
  }

  const onPressCopy = () => {
    if (!signedIn) {
      router.push(href("/signin"))
      return
    }
    if (mode === "manage") {
      setHarmoniumPracticeEnabled(!harmoniumPracticeEnabled)
      return
    }
    if (on) {
      setHarmoniumPracticeEnabled(false)
      return
    }
    Alert.alert(HARMONIUM_ENABLE_IN_PROFILE_TITLE, HARMONIUM_ENABLE_IN_PROFILE_BODY, [
      { text: "Not now", style: "cancel" },
      { text: "Open Profile", onPress: () => router.push(href("/(tabs)/profile")) },
    ])
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Harmonium practice"
        onPress={onPressCopy}
        style={styles.copy}
      >
        <Text style={styles.title}>Harmonium practice</Text>
        <Text style={styles.hint}>
          {signedIn ? HARMONIUM_PRACTICE_HINT_SIGNED_IN : HARMONIUM_PRACTICE_HINT_GUEST}
        </Text>
        {mode === "manage" ? (
          <Text style={styles.state} accessibilityLiveRegion="polite">
            {on ? "On" : "Off"}
          </Text>
        ) : null}
      </Pressable>
      <Switch
        accessibilityLabel="Harmonium practice"
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
