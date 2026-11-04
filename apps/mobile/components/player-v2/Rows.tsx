import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { PressScale } from "@/components/today/motion"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amRadius } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { isDarkTheme } from "@/lib/navV2"

/** The inactive ring of a radio or check: --am-ink-300 in Light, #6A7761 in Dark. */
export function ringColor(theme: AmTheme): string {
  return isDarkTheme(theme) ? "#6A7761" : amColors.ink300
}

/** The selected-row wash (--am-orange-100): #FFDCC5 in Light, #4A2E1C in Dark. */
export function orangeWash(theme: AmTheme): string {
  return isDarkTheme(theme) ? "#4A2E1C" : amColors.orange100
}

/** Rounded white card that holds a list of rows (prototype .group). */
export function SheetGroup({ theme, children }: { theme: AmTheme; children: ReactNode }) {
  return <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.line }]}>{children}</View>
}

/** 24px ring that fills orange with a white dot (single choice). */
export function Radio({ theme, on }: { theme: AmTheme; on: boolean }) {
  return (
    <View style={[styles.ring, { borderColor: on ? amColors.orange500 : ringColor(theme) }, on && styles.ringOn]}>
      {on ? <View style={styles.dot} /> : null}
    </View>
  )
}

/** 24px ring that fills orange with a white tick (multiple choice). */
export function CheckRing({ theme, on }: { theme: AmTheme; on: boolean }) {
  return (
    <View style={[styles.ring, { borderColor: on ? amColors.orange500 : ringColor(theme) }, on && styles.ringOn]}>
      {on ? <View style={styles.tick} /> : null}
    </View>
  )
}

/**
 * One row of a settings group (prototype .lrow): a bold line, a small grey line
 * under it and, on the right, a value or a ring. Feedback starts on touch-down.
 */
export function SheetRow({
  theme,
  title,
  meta,
  value,
  trailing,
  last,
  disabled,
  onPress,
  accessibilityRole = "button",
  selected,
}: {
  theme: AmTheme
  title: string
  meta?: string
  value?: string
  trailing?: ReactNode
  last?: boolean
  disabled?: boolean
  onPress: () => void
  accessibilityRole?: "button" | "radio" | "checkbox"
  selected?: boolean
}) {
  return (
    <PressScale
      accessibilityRole={accessibilityRole}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityState={{ selected, checked: accessibilityRole === "checkbox" ? selected : undefined, disabled }}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.98}
      style={[styles.row, { borderBottomColor: theme.line }, last && styles.rowLast, disabled && styles.disabled]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={[styles.rowMeta, { color: theme.textBody }]} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={[styles.value, { color: theme.eyebrow }]}>{value}</Text> : null}
      {trailing}
    </PressScale>
  )
}

/** Small grey explanation under a group (prototype .note). */
export function SheetNote({ theme, children }: { theme: AmTheme; children: ReactNode }) {
  return <Text style={[styles.note, { color: theme.textBody }]}>{children}</Text>
}

/** Pill button for sheets: 48px, 70px radius (prototype .pill.brand / .sand / .ink). */
export function SheetPill({
  theme,
  label,
  tone = "brand",
  icon,
  onPress,
  disabled,
}: {
  theme: AmTheme
  label: string
  tone?: "brand" | "sand" | "ink"
  icon?: boolean
  onPress: () => void
  disabled?: boolean
}) {
  const fill = tone === "brand" ? amColors.orange500 : tone === "ink" ? theme.textHeading : theme.card
  const ink = tone === "brand" ? amColors.white : tone === "ink" ? theme.page : theme.textHeading
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      pressedScale={0.98}
      style={[
        styles.pill,
        { backgroundColor: fill, borderColor: tone === "sand" ? theme.line : fill },
        disabled && styles.disabled,
      ]}
    >
      {icon ? <PlayerIcon name="plus" size={18} color={ink} /> : null}
      <Text style={[styles.pillText, { color: ink }]}>{label}</Text>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  group: { marginHorizontal: 10, borderRadius: amRadius.card, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 56,
    paddingVertical: 6,
    paddingLeft: 20,
    paddingRight: 16,
    borderBottomWidth: 1,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  rowMeta: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  value: { flexShrink: 0, marginLeft: 12, fontFamily: amFonts.bold, fontSize: 15 },
  disabled: { opacity: 0.4 },
  ring: { width: 24, height: 24, borderRadius: 9999, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  ringOn: { backgroundColor: amColors.orange500 },
  dot: { position: "absolute", left: 3, top: 3, right: 3, bottom: 3, borderRadius: 9999, backgroundColor: amColors.white },
  tick: {
    position: "absolute",
    left: 5,
    top: 1,
    width: 6,
    height: 11,
    borderColor: amColors.white,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: "45deg" }],
  },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, paddingTop: 12, paddingHorizontal: 20 },
  pill: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontFamily: amFonts.semi, fontSize: 16 },
})
