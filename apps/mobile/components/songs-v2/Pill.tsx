import type { ReactNode } from "react"
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"

import { Press } from "@/components/songs-v2/Press"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"

export type PillTone = "brand" | "sand" | "ink" | "danger"

/** Prototype `.pill`: 48px, radius 70. brand = orange, sand = white with a hairline, ink = ink-900. */
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
  theme: SongsTheme
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
    tone === "brand" ? theme.brand : tone === "ink" ? theme.ink900 : tone === "danger" ? amColors.danger : theme.card
  const fg = tone === "sand" ? theme.textHeading : tone === "ink" ? theme.onInk : amColors.white
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.98}
      outerStyle={fill ? styles.fill : undefined}
      style={[
        styles.pill,
        { backgroundColor: bg, borderColor: tone === "sand" ? theme.line : "transparent", borderWidth: tone === "sand" ? 1 : 0, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.pillLabel, { color: fg }]}>{label}</Text>
    </Press>
  )
}

/** Prototype `.chip`: 44px, 15/600, white with a hairline; the chosen one is ink-900 with on-ink text. */
export function Chip({
  theme,
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  theme: SongsTheme
  label: string
  active?: boolean
  onPress: () => void
  accessibilityLabel?: string
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      pressedScale={0.98}
      style={[
        styles.chip,
        active
          ? { backgroundColor: theme.ink900, borderColor: theme.ink900 }
          : { backgroundColor: theme.card, borderColor: theme.line },
      ]}
    >
      <Text style={[styles.chipLabel, { color: active ? theme.onInk : theme.textHeading }]}>{label}</Text>
    </Press>
  )
}

export function Divider({ theme }: { theme: SongsTheme }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line }} />
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pill: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillLabel: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  chip: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 70,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  chipLabel: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 18 },
})
