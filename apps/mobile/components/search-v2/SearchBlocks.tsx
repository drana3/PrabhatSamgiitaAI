import { StyleSheet, Text, View } from "react-native"

import { overStyle, TodaySectionHeading } from "@/components/today/TodayBlocks"
import { readableTitle } from "@/lib/readableTitle"
import { ChevronGlyph } from "@/components/today/protoIcons"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import { amProto, type AmProto } from "@/constants/tokens/amToday"
import {
  resultCountLabel,
  SEARCH_FEELING_CHIPS,
  SEARCH_HINT_ROWS,
  SEARCH_INTRO,
  SEARCH_NO_MATCH,
  type FlatResult,
} from "@/lib/searchProto"
import type { AnswerCard as AnswerCardData, CollectionHit, SearchResultItem } from "@/lib/unifiedSearch"
import { Clock, X } from "lucide-react-native"

type P = { p: AmProto }
const PRESS = 0.98

/** `.muted` line under the field. */
export function DetectLabel({ p, text }: P & { text: string }) {
  return (
    <Text style={[s.detect, { color: p.ink500 }]} accessibilityLiveRegion="polite">
      {text}
    </Text>
  )
}

function Chip({ p, label, onPress, accessibilityLabel }: P & { label: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      pressedScale={PRESS}
      style={[s.chip, { backgroundColor: p.white, borderColor: p.sand300 }]}
    >
      <Text style={[s.chipText, { color: p.ink800 }]}>{label}</Text>
    </TodayPress>
  )
}

/**
 * Empty field (prototype `.s-hint` and `.cloud`): "Write anything", three example rows that fill the
 * field, then "Or start from a feeling" as chips. Recent searches are an extra, kept at the end.
 */
export function EmptyState({
  p,
  recents,
  onPick,
  onRemoveRecent,
  onClearRecents,
}: P & {
  recents: string[]
  onPick: (query: string) => void
  onRemoveRecent: (query: string) => void
  onClearRecents: () => void
}) {
  return (
    <View>
      <View style={s.hint}>
        <TodaySectionHeading p={p} first="Write" second="anything" />
        <Text style={[s.hintText, { color: p.ink500 }]}>{SEARCH_INTRO}</Text>
        {SEARCH_HINT_ROWS.map((row) => (
          <TodayPress
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}, for example ${row.example}`}
            onPress={() => onPick(row.example)}
            pressedScale={PRESS}
            style={[s.cardBtn, { backgroundColor: p.white, borderColor: p.sand300 }]}
          >
            <View style={s.main}>
              <Text style={[overStyle, { color: p.orange700 }]}>{row.label}</Text>
              <Text style={[s.title, { color: p.ink800 }]}>{row.example}</Text>
            </View>
            <ChevronGlyph size={22} color={p.ink500} />
          </TodayPress>
        ))}
      </View>

      <View style={s.feelHead}>
        <TodaySectionHeading p={p} first="Or start from" second="a feeling" />
      </View>
      <View style={s.cloud}>
        {SEARCH_FEELING_CHIPS.map((label) => (
          <Chip key={label} p={p} label={label} accessibilityLabel={`Feeling: ${label}`} onPress={() => onPick(label)} />
        ))}
      </View>

      {recents.length ? (
        <View style={s.recents}>
          <View style={s.recentsHead}>
            <Text style={[overStyle, { color: p.orange700 }]}>Recent searches</Text>
            <TodayPress accessibilityRole="button" accessibilityLabel="Clear recent searches" onPress={onClearRecents} pressedScale={0.94} style={s.clear}>
              <Text style={[s.clearText, { color: p.ink500 }]}>Clear</Text>
            </TodayPress>
          </View>
          {recents.map((item) => (
            <View key={item} style={[s.recentRow, { borderBottomColor: p.sand400 }]}>
              <TodayPress accessibilityRole="button" accessibilityLabel={`Search ${item}`} onPress={() => onPick(item)} pressedScale={PRESS} style={s.recentMain}>
                <Clock size={16} color={p.ink500} />
                <Text style={[s.recentText, { color: p.ink800 }]} numberOfLines={1}>
                  {item}
                </Text>
              </TodayPress>
              <TodayPress accessibilityRole="button" accessibilityLabel={`Remove ${item}`} onPress={() => onRemoveRecent(item)} pressedScale={0.88} style={s.remove}>
                <X size={16} color={p.ink500} />
              </TodayPress>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** `.cardbtn` result: "PS 3", the title and, in orange, why it matched. */
export function ResultCard({ p, row, offline, onOpen }: P & { row: FlatResult; offline: boolean; onOpen: (item: SearchResultItem) => void }) {
  const { item, why } = row
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel={`PS ${item.song.number}, ${item.song.title}. ${why}`}
      onPress={() => onOpen(item)}
      pressedScale={PRESS}
      style={[s.cardBtn, { backgroundColor: p.white, borderColor: p.sand300 }]}
    >
      <View style={s.main}>
        <Text style={[overStyle, { color: p.orange700 }]}>
          PS {item.song.number}
          {row.durationLabel ? ` · ${row.durationLabel}` : ""}
          {offline ? " · Offline" : ""}
        </Text>
        <Text style={[s.title, { color: p.ink800 }]} numberOfLines={2}>
          {readableTitle(item.song.title)}
        </Text>
        <Text style={[s.why, { color: p.orange700 }]}>{why}</Text>
      </View>
    </TodayPress>
  )
}

/** "3 songs" heading and the list of results. */
export function ResultList({ p, rows, offlineNumbers, onOpen }: P & { rows: FlatResult[]; offlineNumbers: ReadonlySet<number>; onOpen: (item: SearchResultItem) => void }) {
  return (
    <View>
      <Text style={[s.count, { color: p.ink800 }]} accessibilityRole="header">
        {resultCountLabel(rows.length)}
      </Text>
      <View style={s.list}>
        {rows.map((row) => (
          <ResultCard key={row.item.song.number} p={p} row={row} offline={offlineNumbers.has(Number(row.item.song.number))} onOpen={onOpen} />
        ))}
      </View>
    </View>
  )
}

/** Collections whose name matches: tapping one fills the field with its name. Extra to the prototype. */
export function CollectionChips({ p, names, onPick }: P & { names: CollectionHit[]; onPick: (label: string) => void }) {
  return (
    <View style={s.cloud}>
      {names.map((hit) => (
        <Chip key={hit.label} p={p} label={`${hit.label} · ${hit.count}`} accessibilityLabel={`Collection ${hit.label}, ${hit.count} songs`} onPress={() => onPick(hit.label)} />
      ))}
    </View>
  )
}

/** Answer to a question, from the songs. Extra to the prototype; uses the forest panel colours. */
export function AnswerCard({
  p,
  answer,
  onOpen,
  onAsk,
}: P & { answer: AnswerCardData; onOpen: (item: SearchResultItem) => void; onAsk: () => void }) {
  return (
    <View style={[s.answer, { backgroundColor: p.sage700 }]}>
      <Text style={[overStyle, { color: "#F5C253" }]}>Answer</Text>
      <Text style={s.answerLead}>
        {answer.sources.length ? "These songs speak to what you asked." : "Ask the assistant. It answers from the songs."}
      </Text>
      {answer.sources.map((item) => (
        <TodayPress key={item.song.number} accessibilityRole="button" accessibilityLabel={`PS ${item.song.number}, ${item.song.title}`} onPress={() => onOpen(item)} pressedScale={PRESS} style={s.source}>
          <Text style={[overStyle, { color: "#F5C253" }]}>PS {item.song.number}</Text>
          <Text style={s.sourceTitle} numberOfLines={2}>
            {item.song.title}
          </Text>
        </TodayPress>
      ))}
      <TodayPress accessibilityRole="button" accessibilityLabel="Ask the assistant" onPress={onAsk} pressedScale={PRESS} style={[s.ask, { backgroundColor: p.orange500 }]}>
        <Text style={s.askText}>Ask the assistant</Text>
      </TodayPress>
    </View>
  )
}

/** `.empty`: nothing matched (or a plain message from the engine). */
export function EmptyMessage({ p, text }: P & { text?: string | null }) {
  return <Text style={[s.empty, { color: p.ink500 }]}>{text || SEARCH_NO_MATCH}</Text>
}

const s = StyleSheet.create({
  detect: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 16, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20.3 },
  hint: { paddingTop: 20, gap: 12 },
  hintText: { marginHorizontal: 20, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 21.6 },
  feelHead: { paddingTop: 32, paddingBottom: 16 },
  cloud: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: amProto.gutter },
  chip: { height: 44, paddingHorizontal: 20, borderRadius: 70, borderWidth: 1, justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 18 },
  cardBtn: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 20,
    paddingRight: 16,
    marginHorizontal: amProto.gutter,
  },
  main: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 22, letterSpacing: -0.19 },
  why: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18.85 },
  count: {
    paddingHorizontal: amProto.gutter,
    paddingBottom: 16,
    fontFamily: amFonts.display,
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: -0.6,
    textTransform: "uppercase",
  },
  list: { gap: 10 },
  empty: { paddingHorizontal: 20, maxWidth: 330, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 21.6 },
  recents: { paddingTop: 32, paddingHorizontal: amProto.gutter + 10 },
  recentsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clear: { minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
  clearText: { fontFamily: amFonts.semi, fontSize: 14 },
  recentRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1 },
  recentMain: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  recentText: { flex: 1, fontFamily: amFonts.medium, fontSize: 16 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  answer: { marginHorizontal: amProto.gutter, borderRadius: 30, padding: 24, gap: 12 },
  answerLead: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 24, color: "#FFFFFF" },
  source: { minHeight: 44, justifyContent: "center", gap: 4 },
  sourceTitle: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 24, color: "#FFFFFF" },
  ask: { alignSelf: "flex-start", height: 48, borderRadius: 70, paddingHorizontal: 24, justifyContent: "center" },
  askText: { fontFamily: amFonts.semi, fontSize: 16, color: "#FFFFFF" },
})
