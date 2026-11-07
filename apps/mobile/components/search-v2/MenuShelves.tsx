import { ScrollView, StyleSheet, Text, View } from "react-native"

import { HOME_INSET, HomeShelf } from "@/components/home/HomeBlocks"
import { KindMark } from "@/components/listening/KindMark"
import { Press } from "@/components/songs-v2/Press"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import type { AmProto } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { HistoryEntry } from "@/lib/listening/history"
import { historySubline } from "@/lib/listening/labels"
import { BABA_AUDIO_KIND } from "@/lib/searchMenu/kinds"
import { menuKind, shelfCountLabel, type MenuKirtan } from "@/lib/searchMenu/live"

type P = { p: AmProto }
const em = (size: number, value: number) => Math.round(size * value * 100) / 100

export const CARD_W = 156

/** Title of a block of shelves (Prabhat Samgiita, Kiirtan, Bhajans by language ...), one line under a small eyebrow when given. */
export function BlockTitle({ p, text, eyebrow }: P & { text: string; eyebrow?: string }) {
  return (
    <View style={s.block}>
      {eyebrow ? <Text style={[overStyle, { color: p.orange700 }]}>{eyebrow}</Text> : null}
      <Text style={[s.blockTitle, { color: p.ink800 }]} accessibilityRole="header">
        {text}
      </Text>
    </View>
  )
}

/** Small heading between two groups inside a block ("Indian Kiirtan by style"). */
export function SubTitle({ p, text }: P & { text: string }) {
  return (
    <Text style={[s.sub, { color: p.ink500 }]} accessibilityRole="header">
      {text}
    </Text>
  )
}

/** Shelf header: its name, how many recordings, a "chosen by the team" tag when pinned, and "See all". */
export function ShelfHead({ p, title, count, note, pinned, onSeeAll }: P & { title: string; count: number; note?: string; pinned?: boolean; onSeeAll?: () => void }) {
  const t = useT()
  return (
    <View style={s.head}>
      <View style={s.headText}>
        <Text style={[s.title, { color: p.ink800 }]} numberOfLines={2} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[s.count, { color: p.ink500 }]} numberOfLines={1}>
          {[note, shelfCountLabel(count)].filter(Boolean).join(" · ")}
        </Text>
        {pinned ? <Text style={[s.pinned, { color: p.orange700 }]}>{t("searchMenu.pinned")}</Text> : null}
      </View>
      {onSeeAll ? (
        <TodayPress accessibilityRole="button" accessibilityLabel={t("searchMenu.seeAll.a11y", { name: title })} onPress={onSeeAll} pressedScale={0.95} style={[s.seeAll, { borderColor: p.sand300 }]}>
          <Text style={[s.seeAllText, { color: p.ink800 }]}>{t("searchMenu.seeAll")}</Text>
        </TodayPress>
      ) : null}
    </View>
  )
}

export function ShelfCard({ theme, kirtan, onPress }: { theme: SongsTheme; kirtan: MenuKirtan; onPress: () => void }) {
  const baba = menuKind(kirtan) === BABA_AUDIO_KIND
  const sub = kirtan.author || kirtan.place || kirtan.addedBy
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={[kirtan.title, sub].filter(Boolean).join(", ")}
      onPress={onPress}
      pressedScale={0.97}
      outerStyle={{ width: CARD_W }}
      style={[s.card, { backgroundColor: baba ? theme.oliveBg : theme.card, borderColor: baba ? theme.oliveBg : theme.line }]}
    >
      <KindMark theme={theme} kind={menuKind(kirtan)} size={36} />
      <View style={s.cardText}>
        <Text style={[s.cardTitle, { color: baba ? theme.oliveText : theme.textHeading }]} numberOfLines={3}>
          {kirtan.title}
        </Text>
        {sub ? (
          <Text style={[s.cardSub, { color: baba ? theme.oliveText : theme.textBody }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Press>
  )
}

/** A shelf of recordings: header, then cards that play the shelf from the tapped one. */
export function ItemShelf({
  p,
  theme,
  title,
  note,
  count,
  pinned,
  items,
  eyebrow,
  onOpen,
  onSeeAll,
}: P & {
  theme: SongsTheme
  title: string
  note?: string
  count: number
  pinned?: boolean
  items: readonly MenuKirtan[]
  eyebrow?: string
  onOpen: (k: MenuKirtan) => void
  onSeeAll: () => void
}) {
  return (
    <View style={s.shelf}>
      {eyebrow ? <Text style={[overStyle, s.eyebrow, { color: p.orange700 }]}>{eyebrow}</Text> : null}
      <ShelfHead p={p} title={title} count={count} note={note} pinned={pinned} onSeeAll={onSeeAll} />
      <HomeShelf itemWidth={CARD_W} gap={10}>
        {items.map((k) => (
          <ShelfCard key={k.id} theme={theme} kirtan={k} onPress={() => onOpen(k)} />
        ))}
      </HomeShelf>
    </View>
  )
}

/** Moods as round chips with how many recordings carry them. A chip opens that mood's list. */
export function MoodChips({ p, items, onPick }: P & { items: readonly { id: string; label: string; count: number }[]; onPick: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {items.map((m) => (
        <TodayPress
          key={m.id}
          accessibilityRole="button"
          accessibilityLabel={`${m.label}, ${shelfCountLabel(m.count)}`}
          onPress={() => onPick(m.id)}
          pressedScale={0.95}
          style={[s.chip, { backgroundColor: p.white, borderColor: p.sand300 }]}
        >
          <Text style={[s.chipText, { color: p.ink800 }]}>{m.label}</Text>
          <Text style={[s.chipCount, { color: p.orange700 }]}>{m.count}</Text>
        </TodayPress>
      ))}
    </ScrollView>
  )
}

/** "Listen again": the last tracks of this phone's own history, newest first. The head links to the whole history. */
export function AgainStrip({
  p,
  theme,
  entries,
  onPlay,
  onAll,
}: P & { theme: SongsTheme; entries: readonly HistoryEntry[]; onPlay: (e: HistoryEntry) => void; onAll: () => void }) {
  const t = useT()
  return (
    <View style={s.shelf}>
      <View style={s.head}>
        <View style={s.headText}>
          <Text style={[s.title, { color: p.ink800 }]} accessibilityRole="header">
            {t("searchMenu.forYou.title")}
          </Text>
        </View>
        <TodayPress accessibilityRole="button" accessibilityLabel={t("searchMenu.forYou.history")} onPress={onAll} pressedScale={0.95} style={[s.seeAll, { borderColor: p.sand300 }]}>
          <Text style={[s.seeAllText, { color: p.ink800 }]}>{t("searchMenu.forYou.history")}</Text>
        </TodayPress>
      </View>
      <HomeShelf itemWidth={168} gap={10}>
        {entries.map((e) => (
          <Press
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={t("searchMenu.forYou.a11y", { title: e.title })}
            onPress={() => onPlay(e)}
            pressedScale={0.97}
            outerStyle={{ width: 168 }}
            style={[s.again, { backgroundColor: theme.card, borderColor: theme.line }]}
          >
            <KindMark theme={theme} kind={e.kind} size={32} />
            <Text style={[s.cardTitle, { color: theme.textHeading }]} numberOfLines={2}>
              {e.title}
            </Text>
            <Text style={[s.cardSub, { color: theme.textBody }]} numberOfLines={1}>
              {historySubline(e)}
            </Text>
          </Press>
        ))}
      </HomeShelf>
    </View>
  )
}

const s = StyleSheet.create({
  block: { paddingHorizontal: HOME_INSET, gap: 4, paddingTop: 12 },
  blockTitle: { fontFamily: amFonts.display, fontSize: 26, lineHeight: 29, letterSpacing: em(26, -0.02), textTransform: "uppercase" },
  sub: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase", paddingHorizontal: HOME_INSET },
  shelf: { gap: 12 },
  eyebrow: { paddingHorizontal: HOME_INSET },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: HOME_INSET },
  headText: { flex: 1, gap: 2 },
  title: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 24, letterSpacing: em(20, -0.01) },
  count: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  pinned: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, marginTop: 2 },
  seeAll: { minHeight: 36, paddingHorizontal: 14, borderRadius: 70, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  seeAllText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  card: { minHeight: 156, borderRadius: 22, borderWidth: 1, padding: 14, gap: 12 },
  again: { minHeight: 124, borderRadius: 22, borderWidth: 1, padding: 14, gap: 8 },
  cardText: { gap: 4 },
  cardTitle: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 19 },
  cardSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17, opacity: 0.86 },
  chips: { gap: 8, paddingHorizontal: HOME_INSET, flexWrap: "nowrap" },
  chip: { height: 44, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  chipText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  chipCount: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18 },
})
