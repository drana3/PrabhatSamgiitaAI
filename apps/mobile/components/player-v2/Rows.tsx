import type { ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Check } from "lucide-react-native"

import { amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFontSize, amFonts, amType } from "@/constants/tokens/amTypography"
import type { AmTheme } from "@/constants/tokens/amColors"

/** Selectable sheet row: title, optional meta line, check on the selected one. */
export function ChoiceRow({
  theme,
  title,
  meta,
  selected,
  disabled,
  onPress,
}: {
  theme: AmTheme
  title: string
  meta?: string
  selected?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.line, backgroundColor: pressed ? theme.raised : "transparent" },
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[amType.body, { fontFamily: amFonts.bold, color: theme.textHeading }]} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={[amType.body, styles.meta, { color: theme.textBody }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {selected ? <Check size={20} color={theme.brand} /> : null}
    </Pressable>
  )
}

/** Pill button for sheets (48px, spec section 1). */
export function PillButton({
  theme,
  label,
  onPress,
  tone = "brand",
  disabled,
}: {
  theme: AmTheme
  label: string
  onPress: () => void
  tone?: "brand" | "ink"
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: tone === "brand" ? (pressed ? theme.brandPress : theme.brand) : theme.textHeading },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[amType.body, { fontFamily: amFonts.semi, color: theme.onBrand }]}>{label}</Text>
    </Pressable>
  )
}

export function SectionLabel({ theme, children }: { theme: AmTheme; children: ReactNode }) {
  return <Text style={[amType.label, styles.section, { color: theme.eyebrow }]}>{children}</Text>
}

/** Row of chips (script, translation, speed, sleep). */
export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>
}

export function Chip({
  theme,
  label,
  selected,
  disabled,
  onPress,
}: {
  theme: AmTheme
  label: string
  selected: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? theme.brand : theme.inner, borderColor: selected ? theme.brand : theme.line },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[amType.body, { fontFamily: amFonts.semi, color: selected ? theme.onBrand : theme.textHeading }]}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
    paddingVertical: amSpace.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: amSpace.s1 },
  meta: { fontSize: amFontSize.label, lineHeight: 18 },
  pill: {
    height: 48,
    borderRadius: amRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: amSpace.s6,
  },
  disabled: { opacity: 0.4 },
  section: { marginTop: amSpace.s6, marginBottom: amSpace.s3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: amSpace.s2 },
  chip: {
    minHeight: amTouchTarget,
    paddingHorizontal: amSpace.s4,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
