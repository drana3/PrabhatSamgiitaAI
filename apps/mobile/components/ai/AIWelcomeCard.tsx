import { useEffect } from "react"
import { Image } from "expo-image"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { ChevronRight } from "lucide-react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"

import { brandAssets } from "@/constants/brand"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { greetFirstName } from "@/lib/displayName"
import { useAuthStore } from "@/stores/authStore"

export function AIWelcomeCard({
  songNumber,
  songTitle,
}: {
  songNumber?: number | null
  songTitle?: string | null
}) {
  const rawDisplayName = useAuthStore((s) => s.displayName)
  const email = useAuthStore((s) => s.email)
  const displayName = greetFirstName(rawDisplayName, email)
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.03, { duration: 1800 }), withTiming(1, { duration: 1800 })),
      -1,
      false,
    )
  }, [scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.logoGlow, animatedStyle]}>
        <Image source={brandAssets.emblemClear} style={styles.logo} contentFit="contain" />
      </Animated.View>
      <Text style={styles.hello}>Namaskar {displayName},</Text>
      <Text style={styles.subtitle}>
        {songNumber
          ? `Ask anything about PS ${songNumber}${songTitle ? ` — ${songTitle}` : ""}. Answers stay grounded on this song.`
          : "Ask about a song number, meaning, or theme — or open a song first for grounded answers."}
      </Text>
    </View>
  )
}

type SuggestionProps = {
  label: string
  onPress: () => void
}

export function SuggestionRow({ label, onPress }: SuggestionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
    >
      <Text style={styles.suggestionText}>{label}</Text>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  logoGlow: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    ...softShadow(1),
  },
  logo: {
    width: 64,
    height: 64,
  },
  hello: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...softShadow(1),
  },
  suggestionPressed: {
    backgroundColor: colors.surfaceSoft,
  },
  suggestionText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    paddingRight: spacing.sm,
  },
})
