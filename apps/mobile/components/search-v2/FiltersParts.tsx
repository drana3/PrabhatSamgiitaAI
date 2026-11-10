import { StyleSheet, Text, View } from "react-native"
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react-native"

import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { amProto, type AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { FilterRow, FilterRowId, FilterSelection } from "@/lib/searchCards/filters"

type P = { p: AmProto }

/** The one button that holds Style, Instrument, Tempo and Performer. It shows how many filters are on. */
export function FiltersButton({ p, count, open, onPress }: P & { count: number; open: boolean; onPress: () => void }) {
  const t = useT()
  const Chevron = open ? ChevronUp : ChevronDown
  return (
    <View style={s.buttonRow}>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={count ? t("searchCards.filters.a11y", { count }) : t("searchCards.filters.button")}
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        pressedScale={0.95}
        style={[s.button, { backgroundColor: count ? p.ink800 : p.white, borderColor: count ? p.ink800 : p.sand300 }]}
        testID="filters-button"
      >
        <SlidersHorizontal size={18} color={count ? p.onInk : p.ink800} strokeWidth={1.9} />
        <Text style={[s.buttonText, { color: count ? p.onInk : p.ink800 }]}>{t("searchCards.filters.button")}</Text>
        {count ? <Text style={[s.badge, { color: p.onInk }]}>{count}</Text> : null}
        <Chevron size={18} color={count ? p.onInk : p.ink500} strokeWidth={1.9} />
      </TodayPress>
    </View>
  )
}

const ROW_KEY: Record<FilterRowId, "searchBy.row.style" | "searchBy.row.instrument" | "searchBy.row.tempo" | "searchBy.row.performer"> = {
  style: "searchBy.row.style",
  instrument: "searchBy.row.instrument",
  tempo: "searchBy.row.tempo",
  performer: "searchBy.row.performer",
}

/** The rows of choices, one choice per row; a chosen one is filled, and a tap on it takes it off. */
export function FiltersPanel({ p, rows, selection, onToggle, onClear }: P & { rows: readonly FilterRow[]; selection: FilterSelection; onToggle: (row: FilterRowId, shelfId: string) => void; onClear: () => void }) {
  const t = useT()
  const any = Object.values(selection).some(Boolean)
  return (
    <View style={[s.panel, { backgroundColor: p.white, borderColor: p.sand300 }]} testID="filters-panel">
      <Text style={[s.note, { color: p.ink500 }]}>{t("searchCards.filters.note")}</Text>
      {rows.map((row) => (
        <View key={row.id} style={s.row}>
          <Text style={[overStyle, { color: p.orange700 }]} accessibilityRole="header">
            {t(ROW_KEY[row.id])}
          </Text>
          <View style={s.chips}>
            {row.options.map((option) => {
              const on = selection[row.id] === option.shelfId
              return (
                <TodayPress
                  key={option.shelfId}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${option.label}, ${option.count}`}
                  onPress={() => onToggle(row.id, option.shelfId)}
                  pressedScale={0.95}
                  style={[s.chip, { backgroundColor: on ? p.action : p.white, borderColor: on ? p.action : p.sand300 }]}
                >
                  <Text style={[s.chipText, { color: on ? p.onAction : p.ink800 }]} numberOfLines={1}>
                    {option.label}
                  </Text>
                  <Text style={[s.chipCount, { color: on ? p.onAction : p.orange700 }]}>{option.count}</Text>
                </TodayPress>
              )
            })}
          </View>
        </View>
      ))}
      {any ? (
        <TodayPress accessibilityRole="button" accessibilityLabel={t("searchCards.filters.clear")} onPress={onClear} pressedScale={0.95} style={s.clear}>
          <Text style={[s.clearText, { color: p.ink800 }]}>{t("searchCards.filters.clear")}</Text>
        </TodayPress>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  buttonRow: { paddingHorizontal: amProto.gutter + 10, flexDirection: "row" },
  button: { height: 44, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  badge: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
  panel: { marginHorizontal: amProto.gutter, borderRadius: 20, borderWidth: 1, padding: 16, gap: 20 },
  note: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  row: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" },
  chipText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  chipCount: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
  clear: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 4 },
  clearText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, textDecorationLine: "underline" },
})
