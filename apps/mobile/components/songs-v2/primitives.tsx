import type { ReactNode } from "react"
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"
import { ChevronRight } from "lucide-react-native"

import { Press } from "@/components/songs-v2/Press"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"

/** Prototype `.over`: 13/16, 600, +0.08em, uppercase, orange-700 (gold in Dark). */
export const overStyle: TextStyle = {
  fontFamily: amFonts.semi,
  fontSize: 13,
  lineHeight: 16,
  letterSpacing: 1.04,
  textTransform: "uppercase",
  fontVariant: ["tabular-nums"],
}

/** Prototype `.t-sec-h2`: 30px, 800, -0.02em, uppercase, two tones. */
export function SectionHeading({
  theme,
  first,
  second,
  style,
}: {
  theme: SongsTheme
  first: string
  second: string
  style?: StyleProp<TextStyle>
}) {
  return (
    <Text style={[styles.h2, { color: theme.textHeading }, style]} accessibilityRole="header">
      {first}
      {"\n"}
      <Text style={{ color: theme.ink300 }}>{second}</Text>
    </Text>
  )
}

/** Prototype `.card.press.cardbtn`: white 20px card with an eyebrow, a title and a chevron. */
export function CardButton({
  theme,
  eyebrow,
  title,
  onPress,
  accessibilityLabel,
}: {
  theme: SongsTheme
  eyebrow: string
  title: string
  onPress: () => void
  accessibilityLabel?: string
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${eyebrow}, ${title}`}
      onPress={onPress}
      pressedScale={0.98}
      style={[styles.cardBtn, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View style={styles.main}>
        <Text style={[overStyle, { color: theme.accent }]} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text style={[styles.cardTitle, { color: theme.textHeading }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <ChevronRight size={22} color={theme.textBody} strokeWidth={1.75} />
    </Press>
  )
}

/** Prototype `.empty`: 16/500 ink-500, padded 20 on the sides. */
export function EmptyNote({ theme, children, style }: { theme: SongsTheme; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: 20 }, style]}>
      <Text style={[styles.empty, { color: theme.textBody }]}>{children}</Text>
    </View>
  )
}

/** Prototype `.pill.brand` (48px) or `.pill.brand.sm` (40px): orange fill, white label. */
export function BrandPill({
  theme,
  label,
  icon,
  onPress,
  small,
  style,
  tone = "brand",
}: {
  theme: SongsTheme
  label: string
  icon?: ReactNode
  onPress: () => void
  small?: boolean
  style?: StyleProp<ViewStyle>
  tone?: "brand" | "danger"
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.98}
      style={[
        small ? styles.pillSm : styles.pill,
        { backgroundColor: tone === "danger" ? "#EC221F" : theme.brand },
        style,
      ]}
    >
      {icon}
      <Text style={[small ? styles.pillSmLabel : styles.pillLabel, { color: "#FFFFFF" }]}>{label}</Text>
    </Press>
  )
}

const styles = StyleSheet.create({
  h2: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 30, letterSpacing: -0.6, textTransform: "uppercase" },
  cardBtn: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 20,
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  main: { flex: 1, minWidth: 0, gap: 4 },
  cardTitle: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 22, letterSpacing: -0.19 },
  empty: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, maxWidth: 34 * 8.5 },
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
  pillSm: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillSmLabel: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
})
