import type { ReactNode } from "react"
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"

import { PressScale } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize, amType } from "@/constants/tokens/amTypography"

/** 44px round button. */
export function CircleButton({
  theme,
  label,
  onPress,
  children,
  filled,
  disabled,
}: {
  theme: AmTheme
  label: string
  onPress: () => void
  children: ReactNode
  filled?: boolean
  disabled?: boolean
}) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.circle,
        { backgroundColor: filled ? theme.brand : theme.card, borderColor: filled ? theme.brand : theme.line },
      ]}
    >
      {children}
    </PressScale>
  )
}

type PillTone = "brand" | "sand" | "card" | "ink"

/** 44px-high pill. `brand` is the orange button with white text. */
export function Pill({
  theme,
  label,
  tone = "card",
  onPress,
  leading,
  trailing,
  selected,
  accessibilityLabel,
  style,
  disabled,
}: {
  theme: AmTheme
  label: string
  tone?: PillTone
  onPress: () => void
  leading?: ReactNode
  trailing?: ReactNode
  selected?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  disabled?: boolean
}) {
  const palette = pillPalette(theme, tone, selected)
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }, style]}
    >
      {leading}
      <Text style={[styles.pillText, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
      {trailing}
    </PressScale>
  )
}

export function pillPalette(theme: AmTheme, tone: PillTone, selected?: boolean) {
  if (tone === "brand") return { bg: theme.brand, fg: theme.onBrand, border: theme.brand }
  if (tone === "ink") return { bg: amColors.ink900, fg: amColors.white, border: amColors.ink900 }
  if (tone === "sand") return { bg: amColors.sand300, fg: theme.textHeading, border: amColors.sand300 }
  if (selected) return { bg: theme.card, fg: theme.textHeading, border: theme.brand }
  return { bg: theme.card, fg: theme.textHeading, border: theme.line }
}

/** Heading of one section of the long page: Roboto 800 caps, two-tone. */
export function SectionHeading({ theme, children }: { theme: AmTheme; children: string }) {
  return (
    <Text style={[amType.heading, styles.heading, { color: theme.textHeading }]} accessibilityRole="header">
      {children}
    </Text>
  )
}

/** White card, 1px sand line, radius 20. */
export function Card({
  theme,
  children,
  style,
}: {
  theme: AmTheme
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }, style]}>{children}</View>
}

export function Empty({ theme, children }: { theme: AmTheme; children: string }) {
  return <Text style={[amType.body, { color: theme.textBody }]}>{children}</Text>
}

const styles = StyleSheet.create({
  circle: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amRadius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    minHeight: amTouchTarget,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: amSpace.s4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: amSpace.s2,
  },
  pillText: { fontFamily: amFonts.semi, fontSize: amFontSize.body },
  heading: { textTransform: "uppercase", fontFamily: amFonts.display, letterSpacing: -0.5 },
  card: {
    borderRadius: amRadius.card,
    borderWidth: 1,
    padding: amSpace.s4,
  },
})
