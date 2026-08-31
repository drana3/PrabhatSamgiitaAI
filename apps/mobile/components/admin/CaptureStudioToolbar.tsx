import { memo } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

export type CaptureToolbarAction = {
  id: string
  label: string
  onPress: () => void
  disabled?: boolean
  primary?: boolean
  danger?: boolean
}

type Props = {
  actions: CaptureToolbarAction[]
  compact?: boolean
  dense?: boolean
}

export const CaptureStudioToolbar = memo(function CaptureStudioToolbar({ actions, compact, dense }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, compact && styles.rowCompact, dense && styles.rowDense]}
      keyboardShouldPersistTaps="handled"
    >
      {actions.map((action) => (
        <Pressable
          key={action.id}
          onPress={action.onPress}
          disabled={action.disabled}
          style={({ pressed }) => [
            styles.btn,
            compact && styles.btnCompact,
            dense && styles.btnDense,
            action.primary && styles.btnPrimary,
            action.danger && styles.btnDanger,
            action.disabled && styles.btnDisabled,
            pressed && !action.disabled && styles.btnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ disabled: Boolean(action.disabled) }}
        >
          <Text
            style={[
              styles.label,
              compact && styles.labelCompact,
              dense && styles.labelDense,
              action.primary && styles.labelPrimary,
              action.danger && styles.labelDanger,
              action.disabled && styles.labelDisabled,
            ]}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  )
})

export function RecordingPulse({
  active,
  noteCount,
  inline,
}: {
  active: boolean
  noteCount: number
  inline?: boolean
}) {
  if (!active) return null
  return (
    <View style={[styles.pulseRow, inline && styles.pulseRowInline]}>
      <View style={styles.pulseDot} />
      <Text style={styles.pulseText}>
        Recording · {noteCount} note{noteCount === 1 ? "" : "s"}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs, alignItems: "center" },
  rowCompact: { paddingVertical: 0 },
  rowDense: { gap: spacing.xs, paddingVertical: 0 },
  btn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: "center",
  },
  btnCompact: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  btnDense: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 36,
  },
  btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnDanger: { backgroundColor: "#fff1f1", borderColor: colors.error },
  btnDisabled: { opacity: 0.45 },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  label: { ...typography.label, color: colors.textPrimary, fontFamily: "Inter_600SemiBold" },
  labelCompact: { ...typography.caption, fontFamily: "Inter_600SemiBold" },
  labelDense: { fontSize: 11, lineHeight: 14, fontFamily: "Inter_600SemiBold" },
  labelPrimary: { color: colors.white },
  labelDanger: { color: colors.error },
  labelDisabled: { color: colors.textMuted },
  pulseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pulseRowInline: {
    justifyContent: "flex-start",
    marginTop: 0,
    gap: spacing.xs,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },
  pulseText: {
    ...typography.caption,
    color: colors.error,
    fontFamily: "Inter_600SemiBold",
  },
})
