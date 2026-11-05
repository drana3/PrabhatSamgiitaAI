import type { ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { ArrowRight, Bell, ChevronRight, Search } from "lucide-react-native"

import { HOME_COVERS, HOME_COVER_FOCUS } from "@/components/home/homeCovers"
import { PressBox } from "@/components/learn-v2/PressBox"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { coverFor } from "@/lib/homeShelves"
import { songStepBars, stepLine, type ContinueModel, type ShelfEntry } from "@/lib/learn/hub"

/**
 * Pieces of the Learn hub (app/learn.tsx): top row, heading, the orange Continue card, the
 * song shelf, the tiles and the Explore rows. Colours come from `p` (protoFor(theme)) so
 * light and dark both read from the one theme; the Continue card keeps its orange in both.
 */

/** Left and right inset of the whole page, as on Home. */
export const HUB_INSET = 20
const PRESS = 0.97
/** Text on the orange Continue card. */
export const ON_ORANGE = "#1A0F08"
const BAR_OFF_ON_ORANGE = "rgba(26, 15, 8, 0.24)"

const em = (size: number, value: number) => Math.round(size * value * 100) / 100

/* ----------------------------------------------------------------- top row */

/** Avatar on the left (opens the profile sheet), search and bell on the right. Not sticky. */
export function HubTopRow({
  p,
  initial,
  unread,
  onAvatar,
  onSearch,
  onBell,
}: {
  p: AmProto
  initial: string
  unread: boolean
  onAvatar: () => void
  onSearch: () => void
  onBell: () => void
}) {
  return (
    <View style={s.topRow}>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel="Profile and settings"
        onPress={onAvatar}
        pressedScale={PRESS}
        style={[s.round44, { backgroundColor: p.dark ? p.orange100 : p.white }]}
      >
        <Text style={[s.avatarText, { color: p.orange700 }]}>{initial}</Text>
      </PressBox>
      <View style={s.flex} />
      <PressBox
        accessibilityRole="search"
        accessibilityLabel="Search"
        onPress={onSearch}
        pressedScale={PRESS}
        style={[s.round44, s.bordered, { backgroundColor: p.white, borderColor: p.sand300 }]}
      >
        <Search size={20} color={p.ink800} strokeWidth={1.9} />
      </PressBox>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel={unread ? "Notifications, unread" : "Notifications"}
        onPress={onBell}
        pressedScale={PRESS}
        style={[s.round44, s.bordered, { backgroundColor: p.white, borderColor: p.sand300 }]}
      >
        <Bell size={20} color={p.ink800} strokeWidth={1.9} />
        {unread ? <View style={[s.dot, { backgroundColor: p.orange500, borderColor: p.white }]} /> : null}
      </PressBox>
    </View>
  )
}

/* ----------------------------------------------------------------- heading */

/** "LEARN" over "Prabhat Samgiita" (lighter), a one-line explanation and the stats line. */
export function HubHeading({
  p,
  explanation,
  stats,
  statsParts,
}: {
  p: AmProto
  explanation: string
  stats: string
  statsParts: ReadonlyArray<{ value: string; rest: string }>
}) {
  return (
    <View style={s.heading}>
      <Text accessibilityRole="header" style={s.h1}>
        <Text style={[s.h1Big, { color: p.ink800 }]}>LEARN</Text>
        {"\n"}
        <Text style={[s.h1Small, { color: p.dark ? p.ink300 : amColors.ink400 }]}>PRABHAT SAMGIITA</Text>
      </Text>
      <Text style={[s.explain, { color: p.ink500 }]}>{explanation}</Text>
      <Text accessibilityLabel={stats} style={[s.stats, { color: p.ink500 }]}>
        {statsParts.map((part, i) => (
          <Text key={part.rest}>
            {i > 0 ? "  ·  " : ""}
            <Text style={[s.statsNum, { color: p.ink800 }]}>{part.value}</Text>
            {part.rest}
          </Text>
        ))}
      </Text>
    </View>
  )
}

/* ----------------------------------------------------------- section head */

/** Eyebrow (gold in dark, orange in light), then the two-tone capitals title. */
export function HubSectionHead({ p, eyebrow, first, second }: { p: AmProto; eyebrow: string; first: string; second: string }) {
  return (
    <View style={s.sectionHead}>
      <Text style={[s.over, { color: p.orange700 }]} numberOfLines={1}>
        {eyebrow}
      </Text>
      <Text accessibilityRole="header" style={s.h2}>
        <Text style={{ color: p.ink800 }}>{first}</Text>
        {"\n"}
        <Text style={{ color: p.ink300 }}>{second}</Text>
      </Text>
    </View>
  )
}

/* ------------------------------------------------------------ continue card */

/** Three bars with their names under them; done ones are filled. */
function ContinueBars({ bars, next }: { bars: ReturnType<typeof songStepBars>; next: number | null }) {
  return (
    <View style={s.cBars} accessible accessibilityLabel={bars.map((b) => `${b.label} ${b.done ? "done" : "to do"}`).join(", ")}>
      {bars.map((bar) => (
        <View key={bar.step} style={s.cBarCol}>
          <View style={[s.cBar, { backgroundColor: bar.done ? ON_ORANGE : BAR_OFF_ON_ORANGE }]} />
          <Text style={[s.cBarLabel, { fontFamily: bar.step === next ? amFonts.bold : amFonts.medium, opacity: bar.done || bar.step === next ? 1 : 0.72 }]}>
            {bar.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

/**
 * The orange card at the top: the song in progress with its three steps and a "Go" button that
 * opens the next step; with nothing in progress it offers a song to start.
 */
export function ContinueCard({ model, onGo }: { model: Exclude<ContinueModel, { kind: "none" }>; onGo: () => void }) {
  const isContinue = model.kind === "continue"
  const path = model.song.path
  const bars = songStepBars(path)
  const next = isContinue ? model.step : null
  const eyebrow = isContinue ? "Continue" : model.first ? "Start your first song" : "Start your next song"
  const line = isContinue ? stepLine(path) : "3 steps: hear, words, play"
  const label = isContinue ? "Go" : "Start"
  return (
    <View style={s.cCard}>
      <View style={s.cTop}>
        <Text style={s.cOver}>{eyebrow}</Text>
        <Text style={s.cOver}>{`PS ${model.song.number}`}</Text>
      </View>
      <Text style={s.cTitle} numberOfLines={3} accessibilityRole="header">
        {model.song.title}
      </Text>
      <ContinueBars bars={bars} next={next} />
      <View style={s.cBottom}>
        <Text style={s.cLine} numberOfLines={2}>
          {line}
        </Text>
        <PressBox
          accessibilityRole="button"
          accessibilityLabel={isContinue ? `Go to ${stepLine(path)}, ${model.song.title}` : `Start ${model.song.title}`}
          onPress={onGo}
          pressedScale={0.94}
          style={s.cGo}
        >
          <Text style={s.cGoText}>{label}</Text>
          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.2} />
        </PressBox>
      </View>
    </View>
  )
}

/* ------------------------------------------------------------- song shelf */

export const SHELF_CARD = 148
const SHELF_GAP = 12

export function SongShelfCard({ p, entry, onPress }: { p: AmProto; entry: ShelfEntry; onPress: () => void }) {
  const bars = songStepBars(entry.path)
  const cover = coverFor(entry.number)
  const line = stepLine(entry.path)
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={`PS ${entry.number}, ${entry.title}. ${line}`}
      onPress={onPress}
      pressedScale={PRESS}
      outerStyle={{ width: SHELF_CARD }}
    >
      <View style={[s.pic, { backgroundColor: p.sage900 }]}>
        <Image
          source={HOME_COVERS[cover]}
          contentFit="cover"
          contentPosition={HOME_COVER_FOCUS[cover]}
          accessibilityIgnoresInvertColors
          style={s.picImg}
        />
        <View style={s.psChip}>
          <Text style={s.psChipText}>{`PS ${entry.number}`}</Text>
        </View>
      </View>
      <Text style={[s.songTitle, { color: p.ink800 }]} numberOfLines={2}>
        {entry.title}
      </Text>
      <View style={s.sBars}>
        {bars.map((bar) => (
          <View key={bar.step} style={[s.sBar, { backgroundColor: bar.done ? p.orange500 : p.sand400 }]} />
        ))}
      </View>
      <Text style={[s.songLine, { color: p.ink500 }]} numberOfLines={1}>
        {line}
      </Text>
    </PressBox>
  )
}

export function SeeAllCard({ p, count, onPress }: { p: AmProto; count: number; onPress: () => void }) {
  const text = count === 0 ? "Your song list" : `${count} ${count === 1 ? "song" : "songs"}`
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={`See all songs. ${text}`}
      onPress={onPress}
      pressedScale={PRESS}
      outerStyle={{ width: SHELF_CARD }}
      style={[s.seeAll, { borderColor: p.sand300, backgroundColor: p.white }]}
    >
      <View style={[s.seeAllIcon, { backgroundColor: p.orange500 }]}>
        <ArrowRight size={22} color={ON_ORANGE} strokeWidth={2.2} />
      </View>
      <Text style={[s.seeAllTitle, { color: p.ink800 }]}>See all</Text>
      <Text style={[s.songLine, { color: p.ink500 }]}>{text}</Text>
    </PressBox>
  )
}

/** Snap shelf; the first card sits on the page inset and the next one peeks in at the edge. */
export function HubShelf({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={SHELF_CARD + SHELF_GAP}
      snapToAlignment="start"
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: HUB_INSET, gap: SHELF_GAP }}
    >
      {children}
    </ScrollView>
  )
}

/* ------------------------------------------------------------------ tiles */

/** A square-ish tile: round icon, title, one line under it. Two sit side by side. */
export function HubTile({
  p,
  icon,
  title,
  subtitle,
  emphasis,
  onPress,
}: {
  p: AmProto
  icon: ReactNode
  title: string
  subtitle: string
  /** the subtitle is the thing to notice (a number of cards due) */
  emphasis?: boolean
  onPress: () => void
}) {
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      pressedScale={PRESS}
      outerStyle={s.flex}
      style={[s.tile, { backgroundColor: p.white, borderColor: p.sand300 }]}
    >
      <View style={[s.tileIcon, { backgroundColor: p.orange100 }]}>{icon}</View>
      <View style={s.tileText}>
        <Text style={[s.tileTitle, { color: p.ink800 }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[s.tileSub, { color: emphasis ? p.orange700 : p.ink500, fontFamily: emphasis ? amFonts.bold : amFonts.medium }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </PressBox>
  )
}

/** Word of the day: one line card, opens the cards of its song. */
export function WordOfDayRow({
  p,
  word,
  meaning,
  songNumber,
  onPress,
}: {
  p: AmProto
  word: string
  meaning: string
  songNumber: number
  onPress: () => void
}) {
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={`Word of the day: ${word}, ${meaning}`}
      onPress={onPress}
      pressedScale={0.985}
      style={[s.wod, { backgroundColor: p.white, borderColor: p.sand300 }]}
    >
      <View style={s.flex}>
        <Text style={[s.over, { color: p.orange700 }]}>{`Word of the day · PS ${songNumber}`}</Text>
        <Text style={[s.wodWord, { color: p.ink800 }]} numberOfLines={1}>
          {word}
        </Text>
        <Text style={[s.rowSub, { color: p.ink500 }]} numberOfLines={2}>
          {meaning}
        </Text>
      </View>
      <ChevronRight size={22} color={p.ink500} strokeWidth={1.9} />
    </PressBox>
  )
}

/** Plain row with a chevron (Explore). */
export function ExploreRow({ p, title, subtitle, onPress }: { p: AmProto; title: string; subtitle?: string; onPress: () => void }) {
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      pressedScale={0.985}
      style={[s.exRow, { backgroundColor: p.white, borderColor: p.sand300 }]}
    >
      <View style={s.flex}>
        <Text style={[s.exTitle, { color: p.ink800 }]}>{title}</Text>
        {subtitle ? <Text style={[s.rowSub, { color: p.ink500 }]}>{subtitle}</Text> : null}
      </View>
      <ChevronRight size={22} color={p.ink500} strokeWidth={1.9} />
    </PressBox>
  )
}

/** Friendly line when there is nothing to show. */
export function HubEmpty({ p, text }: { p: AmProto; text: string }) {
  return <Text style={[s.empty, { color: p.ink500 }]}>{text}</Text>
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: HUB_INSET - 4, paddingTop: 6, paddingBottom: 10 },
  round44: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bordered: { borderWidth: 1 },
  avatarText: { fontFamily: amFonts.display, fontSize: 18, lineHeight: 26 },
  dot: { position: "absolute", top: 9, right: 10, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  heading: { paddingHorizontal: HUB_INSET, paddingTop: 6, gap: 12 },
  h1: {},
  h1Big: { fontFamily: amFonts.display, fontSize: 64, lineHeight: 60, letterSpacing: em(64, -0.025) },
  h1Small: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 28, letterSpacing: em(24, 0.02) },
  explain: { fontFamily: amFonts.regular, fontSize: 17, lineHeight: 24, maxWidth: 330 },
  stats: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, fontVariant: ["tabular-nums"] },
  statsNum: { fontFamily: amFonts.bold },
  sectionHead: { paddingHorizontal: HUB_INSET, gap: 6 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: em(13, 0.08), textTransform: "uppercase" },
  h2: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 30, letterSpacing: em(30, -0.02), textTransform: "uppercase" },
  cCard: { marginHorizontal: HUB_INSET, backgroundColor: amColors.orange500, borderRadius: 14, padding: 20, gap: 16 },
  cTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  cOver: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: em(13, 0.08), textTransform: "uppercase", color: ON_ORANGE, fontVariant: ["tabular-nums"] },
  cTitle: { fontFamily: amFonts.display, fontSize: 32, lineHeight: 32, letterSpacing: em(32, -0.02), textTransform: "uppercase", color: ON_ORANGE },
  cBars: { flexDirection: "row", gap: 8 },
  cBarCol: { flex: 1, gap: 6 },
  cBar: { height: 6, borderRadius: 3 },
  cBarLabel: { fontSize: 12, lineHeight: 15, letterSpacing: 0.2, color: ON_ORANGE },
  cBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cLine: { flex: 1, fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, color: ON_ORANGE },
  cGo: { height: 44, paddingHorizontal: 20, borderRadius: 70, backgroundColor: ON_ORANGE, flexDirection: "row", alignItems: "center", gap: 8 },
  cGoText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22, color: "#FFFFFF" },
  pic: { width: SHELF_CARD, height: SHELF_CARD, borderRadius: 14, overflow: "hidden" },
  picImg: { width: SHELF_CARD, height: SHELF_CARD },
  psChip: { position: "absolute", left: 8, top: 8, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: "rgba(10, 14, 8, 0.62)", justifyContent: "center" },
  psChipText: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.4, color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  songTitle: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 19, letterSpacing: -0.15, marginTop: 10, minHeight: 38 },
  sBars: { flexDirection: "row", gap: 4, marginTop: 8 },
  sBar: { flex: 1, height: 4, borderRadius: 2 },
  songLine: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16, marginTop: 6 },
  seeAll: { width: SHELF_CARD, height: SHELF_CARD, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8 },
  seeAllIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  seeAllTitle: { fontFamily: amFonts.display, fontSize: 18, lineHeight: 22, textTransform: "uppercase" },
  tile: { flex: 1, minHeight: 128, borderRadius: 14, borderWidth: 1, padding: 16, justifyContent: "space-between", gap: 14 },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tileText: { gap: 3 },
  tileTitle: { fontFamily: amFonts.display, fontSize: 19, lineHeight: 22, letterSpacing: -0.2, textTransform: "uppercase" },
  tileSub: { fontSize: 14, lineHeight: 18 },
  wod: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 84, paddingVertical: 14, paddingLeft: 16, paddingRight: 12, borderRadius: 14, borderWidth: 1 },
  wodWord: { fontFamily: amFonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.4, textTransform: "uppercase" },
  rowSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  exRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 12, paddingLeft: 16, paddingRight: 12, borderRadius: 14, borderWidth: 1 },
  exTitle: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22, letterSpacing: -0.17 },
  empty: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, paddingHorizontal: HUB_INSET, maxWidth: 340 },
})
