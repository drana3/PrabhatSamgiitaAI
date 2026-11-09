import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { HOME_INSET } from "@/components/home/HomeBlocks"
import { BlockTitle } from "@/components/search-v2/MenuShelves"
import { TodayPress } from "@/components/today/TodayPress"
import type { AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { SearchByRow, SearchBySection, SearchByValue } from "@/lib/searchMenu/searchBy"

/**
 * "Search by": everything a person can look for, in one place (docs/search-menu.md, section 11). One section at a time
 * (Kiirtan, Prabhat Samgiita, Bhajans, more), each a list of ways to look with the real choices and how many recordings stand
 * behind each. A way of looking with nothing in it yet still shows, with a sentence saying when it will fill, so a person learns
 * it exists. A choice opens its list; an example (a song number, a first line, a feeling) is typed into the search field.
 */
export function SearchByBlock({ p, sections, onOpen, onType }: { p: AmProto; sections: readonly SearchBySection[]; onOpen: (href: string) => void; onType: (query: string) => void }) {
  const t = useT()
  const [current, setCurrent] = useState(sections[0]?.id ?? "kiirtan")
  const shown = sections.find((section) => section.id === current) ?? sections[0]
  if (!shown) return null
  return (
    <View style={s.root} testID="search-by">
      <View>
        <BlockTitle p={p} text={t("searchBy.title")} />
        <Text style={[s.lead, { color: p.ink500 }]}>{t("searchBy.lead")}</Text>
      </View>
      <View style={s.tabs} accessibilityRole="tablist">
        {sections.map((section) => {
          const on = section.id === shown.id
          return (
            <TodayPress
              key={section.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={section.title}
              onPress={() => setCurrent(section.id)}
              pressedScale={0.95}
              style={[s.tab, { backgroundColor: on ? p.ink800 : p.white, borderColor: on ? p.ink800 : p.sand300 }]}
            >
              <Text style={[s.tabText, { color: on ? p.white : p.ink800 }]}>{section.title}</Text>
            </TodayPress>
          )
        })}
      </View>
      <View style={s.rows}>
        {shown.rows.map((row) => (
          <Row key={row.id} p={p} row={row} onOpen={onOpen} onType={onType} />
        ))}
      </View>
    </View>
  )
}

function Row({ p, row, onOpen, onType }: { p: AmProto; row: SearchByRow; onOpen: (href: string) => void; onType: (query: string) => void }) {
  const t = useT()
  return (
    <View style={[s.row, { borderColor: p.sand300 }]} testID={`search-by-${row.id}`}>
      <Text style={[s.rowTitle, { color: p.ink800 }]} accessibilityRole="header">
        {row.title}
      </Text>
      {row.note ? <Text style={[s.note, { color: p.ink500 }]}>{row.note}</Text> : null}
      {row.values.length ? (
        <View style={s.chips}>
          {row.values.map((value) => (
            <Chip key={value.key} p={p} value={value} a11y={value.count === undefined ? value.label : t("searchBy.chipA11y", { label: value.label, count: String(value.count) })} onPress={() => (value.query !== undefined ? onType(value.query) : value.href ? onOpen(value.href) : undefined)} />
          ))}
        </View>
      ) : (
        <Text style={[s.empty, { color: p.ink500 }]}>{row.empty}</Text>
      )}
    </View>
  )
}

function Chip({ p, value, a11y, onPress }: { p: AmProto; value: SearchByValue; a11y: string; onPress: () => void }) {
  return (
    <TodayPress accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} pressedScale={0.95} style={[s.chip, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      <Text style={[s.chipText, { color: p.ink800 }]}>{value.label}</Text>
      {value.count !== undefined ? <Text style={[s.chipCount, { color: p.orange700 }]}>{value.count}</Text> : null}
    </TodayPress>
  )
}

const s = StyleSheet.create({
  root: { gap: 16 },
  lead: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, paddingHorizontal: HOME_INSET },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: HOME_INSET },
  tab: { minHeight: 44, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  tabText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  rows: { gap: 0 },
  row: { gap: 8, paddingHorizontal: HOME_INSET, paddingVertical: 16, borderTopWidth: 1 },
  rowTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  empty: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  chipText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  chipCount: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
})
