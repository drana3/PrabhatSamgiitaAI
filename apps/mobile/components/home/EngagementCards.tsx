import { Pressable, StyleSheet, Text, View } from "react-native"
import { Award, MessageSquareHeart } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type QuizBannerProps = {
  isGuest: boolean
  onPress: () => void
  onScanPress?: () => void
}

export function QuizBanner({ isGuest, onPress, onScanPress }: QuizBannerProps) {
  return (
    <View style={styles.cardWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open quiz"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
      >
        <View style={styles.icon}>
          <Award size={20} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Prabhat Samgiita Quiz</Text>
          <Text style={styles.sub}>
            {isGuest
              ? "Sign in to take the 10-question journey and earn a certificate."
              : "Continue your levels — starter, intermediate, and experienced."}
          </Text>
        </View>
      </Pressable>
      {!isGuest && onScanPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan live quiz QR code"
          onPress={onScanPress}
          style={({ pressed }) => [styles.scanChip, pressed && { opacity: 0.94 }]}
        >
          <Text style={styles.scanText}>Scan live quiz QR</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

type FeedbackChipProps = {
  onPress: () => void
}

export function FeedbackEntryCard({ onPress }: FeedbackChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Send feedback"
      onPress={onPress}
      style={({ pressed }) => [styles.feedback, pressed && { opacity: 0.94 }]}
    >
      <MessageSquareHeart size={18} color={colors.secondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.feedbackTitle}>Share feedback</Text>
        <Text style={styles.feedbackSub}>Help us improve listening, search, and AI.</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  cardWrap: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
  },
  title: {
    ...typography.label,
    fontSize: 16,
    color: colors.textPrimary,
  },
  sub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  scanChip: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
  },
  scanText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },
  feedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedbackTitle: {
    ...typography.label,
    color: colors.textPrimary,
  },
  feedbackSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
})
