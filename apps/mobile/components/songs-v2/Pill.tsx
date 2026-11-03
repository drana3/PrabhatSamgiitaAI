import type { ReactNode } from "react"
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"

import { Press } from "@/components/songs-v2/Press"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amControl, amGap, amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"

export type PillTone = "brand" | "sand" | "forest" | "danger"

/** 48px pill button, radius 70. Text on the orange fill is always white. */
export function PillButton({
  theme,
  label,
  onPress,
  tone = "brand",
  icon,
  style,
  accessibilityLabel,
  disabled,
  fill,
}: {
  theme: AmTheme
  label: string
  onPress: () => void
  /** share the row equally with sibling pills */
  fill?: boolean
  tone?: PillTone
  icon?: ReactNode
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  disabled?: boolean
}) {
  const bg =
    tone === "brand" ? theme.brand : tone === "forest" ? theme.forest : tone === "danger" ? amColors.danger : theme.inner
  const fg = tone === "sand" ? theme.textHeading : amColors.white
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.96}
      outerStyle={fill ? styles.fill : undefined}
      style={[styles.pill, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {icon}
      <Text style={[styles.pillLabel, { color: fg }]}>{label}</Text>
    </Press>
  )
}

/** Text-only pill chip. 44px high so it meets the touch target. */
export function Chip({
  theme,
  label,
  active,
  onPress,
  trailing,
  accessibilityLabel,
}: {
  theme: AmTheme
  label: string
  active?: boolean
  onPress: () => void
  trailing?: ReactNode
  accessibilityLabel?: string
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      pressedScale={0.95}
      style={[
        styles.chip,
        active
          ? { backgroundColor: theme.brand, borderColor: theme.brand }
          : { backgroundColor: theme.card, borderColor: theme.line },
      ]}
    >
      <Text style={[styles.chipLabel, { color: active ? theme.onBrand : theme.textHeading }]}>{label}</Text>
      {trailing}
    </Press>
  )
}

/** A removable text token for an applied filter. */
export function Token({ theme, label, onRemove }: { theme: AmTheme; label: string; onRemove: () => void }) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`Remove filter ${label}`}
      onPress={onRemove}
      pressedScale={0.95}
      style={[styles.token, { backgroundColor: theme.inner, borderColor: theme.line }]}
    >
      <Text style={[amType.label, { color: theme.textHeading }]}>{label}</Text>
      <Text style={[amType.label, { color: theme.textMuted }]}>×</Text>
    </Press>
  )
}

export function Divider({ theme }: { theme: AmTheme }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line }} />
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pill: {
    height: amControl.pillHeight,
    minWidth: amTouchTarget,
    borderRadius: amRadius.pill,
    paddingHorizontal: amGap.padCard,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: amSpace.s2,
  },
  pillLabel: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  chip: {
    height: amTouchTarget,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: amSpace.s4,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s1,
  },
  chipLabel: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  token: {
    height: amTouchTarget,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: amSpace.s3,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s2,
  },
})
