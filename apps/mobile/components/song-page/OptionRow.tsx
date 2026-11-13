import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { OPTION_ROW_HEIGHT } from "@/lib/songPage/optionsPlacement"

/**
 * ONE ROW OF A SMALL SETTINGS CARD (the Aa window, and the lists of its sheets). Every row has the same height and the
 * same two columns: the name on the left, the control or the chosen value with its arrow on the right, both centred on
 * the row's middle line. A short hint may sit under the name, in small type, only when the row needs one. No rules
 * between rows: the rhythm of equal rows and equal gaps does the separating.
 */
export function OptionRow({
  t,
  label,
  hint,
  onPress,
  a11y,
  role,
  selected,
  children,
}: {
  t: SpTheme
  label: string
  /** small text under the name, for the row that needs one */
  hint?: string | null
  /** a tappable row (it opens something, or picks it); a row with a control inside takes no press itself */
  onPress?: () => void
  a11y?: string
  role?: "button" | "radio"
  selected?: boolean
  children?: ReactNode
}) {
  const inner = (
    <>
      <View style={styles.names}>
        <Text style={[styles.label, { color: t.ink900 }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: t.ink500 }]}>{hint}</Text> : null}
      </View>
      {children ? <View style={styles.control}>{children}</View> : null}
    </>
  )
  if (!onPress) return <View style={styles.row}>{inner}</View>
  return (
    <SpPress
      onPress={onPress}
      accessibilityRole={role ?? "button"}
      accessibilityLabel={a11y ?? label}
      accessibilityState={role === "radio" ? { selected: Boolean(selected) } : undefined}
      pressedScale={0.985}
      style={styles.row}
    >
      {inner}
    </SpPress>
  )
}

/** The value side of a row that opens something: what is chosen (and "+N" when more are), then the arrow. */
export function OptionValue({ t, text, more, muted, arrow = true }: { t: SpTheme; text: string; more?: string | null; muted?: boolean; arrow?: boolean }) {
  return (
    <View style={styles.value}>
      {text ? (
        <Text style={[styles.valueText, { color: muted ? t.ink500 : t.ink900 }]} numberOfLines={1}>
          {text}
        </Text>
      ) : null}
      {more ? <Text style={[styles.valueMore, { color: t.ink500 }]}>{more}</Text> : null}
      {/* a value with no choice behind it keeps the arrow's room, so every value ends on the same line */}
      {arrow ? <SpIcon name="chevRight" size={18} color={t.ink500} strokeWidth={2.2} /> : <View style={styles.noArrow} />}
    </View>
  )
}

/** The mark at the right of a chosen row in a list of choices. */
export function OptionTick({ t, on }: { t: SpTheme; on: boolean }) {
  const fill = t.dark ? t.action : t.ink900
  return (
    <View style={[styles.tick, { borderColor: on ? fill : t.sand400, backgroundColor: on ? fill : "transparent" }]}>
      {on ? <SpIcon name="check" size={14} color={t.dark ? t.onAction : t.onInk} strokeWidth={2.6} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: OPTION_ROW_HEIGHT, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  names: { flex: 1, flexShrink: 1, gap: 2 },
  label: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  control: { flexShrink: 0, maxWidth: "62%", flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  value: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  valueText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  valueMore: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
  noArrow: { width: 18, height: 18 },
  tick: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
})
