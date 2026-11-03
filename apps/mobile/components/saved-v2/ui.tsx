import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { ChevronLeft, Heart } from "lucide-react-native"

import { PressScale } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amControl, amGap, amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"

type ThemeProps = { theme: AmTheme }

/** Heading in two tones: first line in ink, second in a lighter ink. */
export function SectionHeading({ theme, first, second }: ThemeProps & { first: string; second: string }) {
  return (
    <Text style={[amType.title, styles.heading]} accessibilityRole="header">
      <Text style={{ color: theme.textHeading }}>{first}</Text>
      {"\n"}
      <Text style={{ color: amColors.ink300 }}>{second}</Text>
    </Text>
  )
}

/** 44px round glass-less button: back, close. */
export function BackButton({ theme, onPress, label = "Back" }: ThemeProps & { onPress: () => void; label?: string }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.92}
      style={[styles.round, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <ChevronLeft size={22} color={theme.textHeading} />
    </PressScale>
  )
}

/** Heart that stays inside the palette: orange fill when saved. */
export function HeartButton({
  theme,
  saved,
  onPress,
  label,
}: ThemeProps & { saved: boolean; onPress: () => void; label: string }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: saved }}
      onPress={onPress}
      pressedScale={0.88}
      style={styles.heart}
    >
      <Heart size={22} color={saved ? theme.brand : theme.textBody} fill={saved ? theme.brand : "transparent"} />
    </PressScale>
  )
}

type PillTone = "brand" | "ink" | "sand" | "danger"

/** Pill button, 48px high. Text on orange is always white. */
export function PillButton({
  theme,
  label,
  onPress,
  tone = "brand",
  disabled,
  icon,
}: ThemeProps & {
  label: string
  onPress: () => void
  tone?: PillTone
  disabled?: boolean
  icon?: ReactNode
}) {
  const palette = {
    brand: { bg: theme.brand, fg: theme.onBrand, border: "transparent" },
    ink: { bg: amColors.ink900, fg: amColors.white, border: "transparent" },
    sand: { bg: theme.card, fg: theme.textHeading, border: theme.line },
    danger: { bg: amColors.danger, fg: amColors.white, border: "transparent" },
  }[tone]
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.97}
      style={[
        styles.pill,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      {icon}
      <Text style={[styles.pillText, { color: palette.fg }]}>{label}</Text>
    </PressScale>
  )
}

/** A white 20px card row with the site's hairline. */
export function CardRow({ theme, children }: ThemeProps & { children: ReactNode }) {
  return <View style={[styles.cardRow, { backgroundColor: theme.card, borderColor: theme.line }]}>{children}</View>
}

/** Quiet single-line note. */
export function Note({ theme, children }: ThemeProps & { children: ReactNode }) {
  return <Text style={[amType.body, { color: theme.textBody }]}>{children}</Text>
}

export const rowStyles = StyleSheet.create({
  copy: { flex: 1, gap: 6 },
  title: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 24 },
})

const styles = StyleSheet.create({
  heading: { marginBottom: amGap.block },
  round: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amTouchTarget / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heart: {
    width: amTouchTarget,
    height: amTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    height: amControl.pillHeight,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillText: { fontFamily: amFonts.bold, fontSize: 16 },
  cardRow: {
    minHeight: 64,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingLeft: amGap.padCard,
    paddingRight: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
})
