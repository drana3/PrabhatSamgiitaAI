import { StyleSheet, Switch, Text, View } from "react-native"
import { Guitar } from "lucide-react-native"

import { ResultCard } from "@/components/search-v2/SearchBlocks"
import { overStyle } from "@/components/today/TodayBlocks"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amProto, type AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { switchTrackOff } from "@/lib/controlColors"
import { useT } from "@/lib/i18n"
import type { ChordSplit } from "@/lib/searchCards/chordsMode"
import type { FlatResult } from "@/lib/searchProto"
import type { SearchResultItem } from "@/lib/unifiedSearch"

type P = { p: AmProto }

/**
 * "Songs with chords first": a guitar, the words, and a switch. It is on by itself when the query asks for chords (the second
 * line says so); one tap turns it off, and the same tap turns it on for any other query.
 */
export function ChordsBar({ p, theme, on, asked, onToggle }: P & { theme: SongsTheme; on: boolean; asked: boolean; onToggle: (on: boolean) => void }) {
  const t = useT()
  return (
    <View style={[s.bar, { backgroundColor: p.white, borderColor: p.sand300 }]} testID="chords-bar">
      <Guitar size={22} color={on ? p.orange700 : p.ink500} strokeWidth={1.9} />
      <View style={s.text}>
        <Text style={[s.label, { color: p.ink800 }]}>{t("searchCards.chords.label")}</Text>
        {asked ? <Text style={[s.asked, { color: p.orange700 }]}>{t("searchCards.chords.asked")}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={t("searchCards.chords.a11y")}
        value={on}
        onValueChange={onToggle}
        trackColor={{ false: switchTrackOff(theme), true: theme.brand }}
        thumbColor={theme.onBrand}
        testID="chords-switch"
      />
    </View>
  )
}

/** The songs with chords as their own block on top, the other songs after it, each under a small heading with its count. */
export function ChordGroups({
  p,
  split,
  offlineNumbers,
  onOpen,
}: P & { split: ChordSplit<FlatResult>; offlineNumbers: ReadonlySet<number>; onOpen: (item: SearchResultItem) => void }) {
  const t = useT()
  const group = (rows: FlatResult[], title: string, id: string) =>
    rows.length ? (
      <View style={s.group} testID={id}>
        <Text style={[overStyle, s.heading, { color: p.orange700 }]} accessibilityRole="header">
          {title} · {rows.length}
        </Text>
        <View style={s.list}>
          {rows.map((row) => (
            <ResultCard key={row.item.song.number} p={p} row={row} offline={offlineNumbers.has(Number(row.item.song.number))} onOpen={onOpen} />
          ))}
        </View>
      </View>
    ) : null
  return (
    <View style={s.groups}>
      {group(split.withChords, t("searchCards.chords.group"), "chords-group")}
      {group(split.rest, t("searchCards.chords.rest"), "chords-rest")}
    </View>
  )
}

/** A quiet line under the switch: the list is not known (offline), or no result has chords. */
export function ChordsNote({ p, text }: P & { text: string }) {
  return (
    <Text style={[s.note, { color: p.ink500 }]} accessibilityLiveRegion="polite">
      {text}
    </Text>
  )
}

const s = StyleSheet.create({
  bar: { marginHorizontal: amProto.gutter, minHeight: 64, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingLeft: 16, paddingRight: 12 },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  asked: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  groups: { gap: 24 },
  group: { gap: 12 },
  heading: { paddingHorizontal: amProto.gutter + 10 },
  list: { gap: 10 },
  note: { paddingHorizontal: amProto.gutter + 10, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
})
