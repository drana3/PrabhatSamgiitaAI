import { StyleSheet, Text, View } from "react-native"
import { ChevronRight, Plus, Search } from "lucide-react-native"

import { HUB_INSET } from "@/components/learn-v2/LearnHub"
import { PressBox } from "@/components/learn-v2/PressBox"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import type { HubSong } from "@/lib/learn/hub"
import type { StatusCounts } from "@/lib/learn/songStatus"
import { useT } from "@/lib/i18n"

/**
 * Pieces of the Learn chain (variant A): the three counters under "My songs" and the column
 * "I want to learn this". Colours come from `p` (protoFor(theme)), so light and dark read from one place.
 */

/* ---------------------------------------------------------------- counters */

/** Not started, Learning, Learned: three tiles with the number of songs on the learner's list. Display only. */
export function StatusCounters({ p, counts }: { p: AmProto; counts: StatusCounts }) {
  const t = useT()
  const items = [
    { key: "notStarted", label: t("learn.page.counter.notStarted"), count: counts.notStarted },
    { key: "learning", label: t("learn.page.counter.learning"), count: counts.learning },
    { key: "learned", label: t("learn.page.counter.learned"), count: counts.learned },
  ] as const
  return (
    <View accessibilityRole="summary" accessibilityLabel={t("learn.page.counters.a11y")} style={s.counters}>
      {items.map((item) => (
        <View
          key={item.key}
          accessible
          accessibilityLabel={t("learn.page.counter.a11y", { label: item.label, count: item.count })}
          style={[s.counter, { backgroundColor: p.white, borderColor: p.sand300 }]}
        >
          <Text style={[s.counterNum, { color: item.count > 0 && item.key !== "notStarted" ? p.ink800 : p.ink500 }]}>{item.count}</Text>
          <Text style={[s.counterLabel, { color: p.ink500 }]} numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

/* ------------------------------------------------------------------ choose */

/**
 * One suggested song: its title, "PS 2 · Words ready" or "PS 2 · Words coming soon", and the "+ Learn" button
 * that puts it on the list. The row itself opens the song's page.
 */
export function ChooseRow({
  p,
  song,
  wordsReady,
  onOpen,
  onAdd,
}: {
  p: AmProto
  song: HubSong
  wordsReady: boolean
  onOpen: () => void
  onAdd: () => void
}) {
  const t = useT()
  const sub = t(wordsReady ? "learn.page.choose.wordsReady" : "learn.page.choose.wordsSoon", { number: song.number })
  return (
    <View style={[s.chooseRow, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel={`${song.title}. ${sub}`}
        onPress={onOpen}
        pressedScale={0.985}
        outerStyle={s.flex}
        style={s.chooseText}
      >
        <Text style={[s.chooseTitle, { color: p.ink800 }]} numberOfLines={2}>
          {song.title}
        </Text>
        <Text style={[s.chooseSub, { color: p.ink500 }]} numberOfLines={1}>
          {sub}
        </Text>
      </PressBox>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel={t("learn.add.row.add.a11y", { number: song.number, title: song.title })}
        onPress={onAdd}
        pressedScale={0.94}
        style={[s.addButton, { backgroundColor: p.action }]}
      >
        <Plus size={18} color={p.onAction} strokeWidth={2.4} />
        <Text style={[s.addText, { color: p.onAction }]}>{t("learn.page.choose.add")}</Text>
      </PressBox>
    </View>
  )
}

/** "Search all 5018 songs": opens the picker. */
export function SearchAllRow({ p, count, onPress }: { p: AmProto; count: number; onPress: () => void }) {
  const t = useT()
  const sub = t("learn.page.choose.searchSub", { count })
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={`${t("learn.page.choose.search")}. ${sub}`}
      onPress={onPress}
      pressedScale={0.985}
      style={[s.searchRow, { backgroundColor: p.white, borderColor: p.ink900 }]}
    >
      <Search size={20} color={p.ink800} strokeWidth={1.9} />
      <View style={s.flex}>
        <Text style={[s.chooseTitle, { color: p.ink800 }]}>{t("learn.page.choose.search")}</Text>
        <Text style={[s.chooseSub, { color: p.ink500 }]} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <ChevronRight size={22} color={p.ink500} strokeWidth={1.9} />
    </PressBox>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  counters: { flexDirection: "row", gap: 8, paddingHorizontal: HUB_INSET },
  counter: { flex: 1, minHeight: 84, borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 12, justifyContent: "space-between", gap: 8 },
  counterNum: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 40, letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
  counterLabel: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16 },
  chooseRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 72, borderRadius: 14, borderWidth: 1, paddingLeft: 4, paddingRight: 12 },
  chooseText: { paddingVertical: 12, paddingLeft: 12, gap: 3 },
  chooseTitle: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20, letterSpacing: -0.16 },
  chooseSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  addButton: { height: 44, minWidth: 44, paddingLeft: 10, paddingRight: 14, borderRadius: 70, flexDirection: "row", alignItems: "center", gap: 4 },
  addText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingLeft: 16, paddingRight: 12 },
})
