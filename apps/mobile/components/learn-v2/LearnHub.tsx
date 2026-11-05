import type { ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { ArrowRight, Bell, ChevronRight, Plus, Search, X } from "lucide-react-native"

import { AvatarFace } from "@/components/profile-v2/AvatarFace"
import { HOME_COVERS, HOME_COVER_FOCUS } from "@/components/home/homeCovers"
import { PressBox } from "@/components/learn-v2/PressBox"
import { amColors, amPhotoChip } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { coverFor } from "@/lib/homeShelves"
import { songStepBars, stepLine, type ContinueModel, type ShelfEntry } from "@/lib/learn/hub"
import { useLanguage, useT } from "@/lib/i18n"

/**
 * Pieces of the Learn hub (app/learn.tsx): top row, heading, the forest Continue card, the
 * song shelf, the tiles and the Explore rows. Colours come from `p` (protoFor(theme)) so
 * light and dark both read from the one theme; the Continue card keeps its orange in both.
 */

/** Left and right inset of the whole page, as on Home. */
export const HUB_INSET = 20
const PRESS = 0.97
/** The Continue card is a deep forest tile (sage800): sand50 / white text, gold300 eyebrow, bright orange only for the done bars. */
const CARD_TEXT = amColors.white
const BAR_OFF_ON_FOREST = "rgba(255, 255, 255, 0.24)"

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
  const t = useT()
  return (
    <View style={s.topRow}>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel={t("today.profileA11y")}
        onPress={onAvatar}
        pressedScale={PRESS}
        style={[s.round44, { backgroundColor: p.dark ? p.orange100 : p.white }]}
      >
        <AvatarFace initial={initial} textStyle={[s.avatarText, { color: p.orange700 }]} />
      </PressBox>
      <View style={s.flex} />
      <PressBox
        accessibilityRole="search"
        accessibilityLabel={t("home.search")}
        onPress={onSearch}
        pressedScale={PRESS}
        style={[s.round44, s.bordered, { backgroundColor: p.white, borderColor: p.sand300 }]}
      >
        <Search size={20} color={p.ink800} strokeWidth={1.9} />
      </PressBox>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel={unread ? t("home.notificationsUnread") : t("home.notifications")}
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
  const t = useT()
  return (
    <View style={s.heading}>
      <Text accessibilityRole="header" style={s.h1}>
        <Text style={[s.h1Big, { color: p.ink800 }]}>{t("tabs.learn").toUpperCase()}</Text>
        {"\n"}
        <Text style={[s.h1Small, { color: p.ink300 }]}>PRABHAT SAMGIITA</Text>
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

/**
 * Eyebrow (gold in dark, orange in light), then the two-tone capitals title. `right` is an optional
 * control (the "Add a song" pill) at the right end of the head.
 */
export function HubSectionHead({
  p,
  eyebrow,
  first,
  second,
  right,
}: {
  p: AmProto
  eyebrow: string
  first: string
  second: string
  right?: ReactNode
}) {
  const head = (
    <View style={right ? s.sectionHeadText : s.sectionHead}>
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
  if (!right) return head
  return (
    <View style={s.sectionHeadRow}>
      {head}
      {right}
    </View>
  )
}

/** "+ Add a song": opens the picker. orange700 fill, white text and icon, 44pt high. */
export function AddSongPill({ p, onPress }: { p: AmProto; onPress: () => void }) {
  const t = useT()
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={t("learn.add.cta.a11y")}
      onPress={onPress}
      pressedScale={0.95}
      style={[s.addPill, { backgroundColor: p.action }]}
    >
      <Plus size={20} color={p.onAction} strokeWidth={2.4} />
      <Text style={[s.addPillText, { color: p.onAction }]}>{t("learn.add.cta")}</Text>
    </PressBox>
  )
}

/* ------------------------------------------------------------ continue card */

/** Three bars with their names under them; done ones are filled. */
function ContinueBars({ bars, next }: { bars: ReturnType<typeof songStepBars>; next: number | null }) {
  const t = useT()
  return (
    <View style={s.cBars} accessible accessibilityLabel={bars.map((b) => t(b.done ? "learn.bar.done" : "learn.bar.todo", { name: b.label })).join(", ")}>
      {bars.map((bar) => (
        <View key={bar.step} style={s.cBarCol}>
          <View style={[s.cBar, { backgroundColor: bar.done ? amColors.orange500 : BAR_OFF_ON_FOREST }]} />
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
  const t = useT()
  const isContinue = model.kind === "continue"
  const path = model.song.path
  const bars = songStepBars(path)
  const next = isContinue ? model.step : null
  const eyebrow = isContinue ? t("learn.continue") : model.first ? t("learn.startFirst") : t("learn.startNext")
  const line = isContinue ? stepLine(path) : t("learn.threeSteps")
  const label = isContinue ? t("learn.go") : t("learn.start")
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
          accessibilityLabel={isContinue ? t("learn.goTo", { step: stepLine(path), title: model.song.title }) : t("learn.startA11y", { title: model.song.title })}
          onPress={onGo}
          pressedScale={0.94}
          style={s.cGo}
        >
          <Text style={s.cGoText}>{label}</Text>
          <ArrowRight size={18} color={amColors.ink900} strokeWidth={2.2} />
        </PressBox>
      </View>
    </View>
  )
}

/* ------------------------------------------------------------- song shelf */

export const SHELF_CARD = 148
const SHELF_GAP = 12

export function SongShelfCard({
  p,
  entry,
  onPress,
  onRemove,
}: {
  p: AmProto
  entry: ShelfEntry
  onPress: () => void
  /** only for songs on the learner's list; draws the small "x" and the "Remove" screen-reader action */
  onRemove?: () => void
}) {
  const t = useT()
  useLanguage() // re-render when the language changes: the step line comes from lib/learn/hub
  const bars = songStepBars(entry.path)
  const cover = coverFor(entry.number)
  const line = stepLine(entry.path)
  const removable = Boolean(onRemove) && entry.listed
  return (
    <View style={{ width: SHELF_CARD }}>
      <PressBox
        accessibilityRole="button"
        accessibilityLabel={`PS ${entry.number}, ${entry.title}. ${line}`}
        accessibilityActions={removable ? [{ name: "remove", label: t("learn.remove.action") }] : undefined}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "remove") onRemove?.()
        }}
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
      {removable ? (
        <PressBox
          accessibilityRole="button"
          accessibilityLabel={t("learn.remove.a11y", { number: entry.number })}
          onPress={onRemove}
          pressedScale={0.88}
          outerStyle={s.removeHit}
          style={s.removeDot}
        >
          <X size={16} color={amPhotoChip.glass.fg} strokeWidth={2.4} />
        </PressBox>
      ) : null}
    </View>
  )
}

export function SeeAllCard({ p, count, onPress }: { p: AmProto; count: number; onPress: () => void }) {
  const t = useT()
  const text = count === 0 ? t("learn.seeAll.empty") : t("songs.count", { count })
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={t("learn.seeAll.a11y", { text })}
      onPress={onPress}
      pressedScale={PRESS}
      outerStyle={{ width: SHELF_CARD }}
      style={[s.seeAll, { borderColor: p.sand300, backgroundColor: p.white }]}
    >
      <View style={[s.seeAllIcon, { backgroundColor: p.ink900 }]}>
        <ArrowRight size={22} color={p.onInk} strokeWidth={2.2} />
      </View>
      <Text style={[s.seeAllTitle, { color: p.ink800 }]}>{t("learn.seeAll")}</Text>
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
  const t = useT()
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={t("learn.wordOfDay.a11y", { word, meaning })}
      onPress={onPress}
      pressedScale={0.985}
      style={[s.wod, { backgroundColor: p.white, borderColor: p.sand300 }]}
    >
      <View style={s.flex}>
        <Text style={[s.over, { color: p.orange700 }]}>{t("learn.wordOfDay", { number: songNumber })}</Text>
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
  sectionHeadRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: HUB_INSET },
  sectionHeadText: { flex: 1, minWidth: 0, gap: 6 },
  addPill: { height: 44, paddingLeft: 14, paddingRight: 18, borderRadius: 70, flexDirection: "row", alignItems: "center", gap: 6 },
  addPillText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  removeHit: { position: "absolute", right: 0, top: 0, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  removeDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: amPhotoChip.glass.bg, alignItems: "center", justifyContent: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: em(13, 0.08), textTransform: "uppercase" },
  h2: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 30, letterSpacing: em(30, -0.02), textTransform: "uppercase" },
  cCard: { marginHorizontal: HUB_INSET, backgroundColor: amColors.sage800, borderRadius: 14, padding: 20, gap: 16 },
  cTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  cOver: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: em(13, 0.08), textTransform: "uppercase", color: amColors.gold300, fontVariant: ["tabular-nums"] },
  cTitle: { fontFamily: amFonts.display, fontSize: 32, lineHeight: 32, letterSpacing: em(32, -0.02), textTransform: "uppercase", color: CARD_TEXT },
  cBars: { flexDirection: "row", gap: 8 },
  cBarCol: { flex: 1, gap: 6 },
  cBar: { height: 6, borderRadius: 3 },
  cBarLabel: { fontSize: 12, lineHeight: 15, letterSpacing: 0.2, color: CARD_TEXT },
  cBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cLine: { flex: 1, fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, color: CARD_TEXT },
  cGo: { height: 44, paddingHorizontal: 20, borderRadius: 70, backgroundColor: amColors.white, flexDirection: "row", alignItems: "center", gap: 8 },
  cGoText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22, color: amColors.ink900 },
  pic: { width: SHELF_CARD, height: SHELF_CARD, borderRadius: 14, overflow: "hidden" },
  picImg: { width: SHELF_CARD, height: SHELF_CARD },
  psChip: { position: "absolute", left: 8, top: 8, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: amPhotoChip.glass.bg, justifyContent: "center" },
  psChipText: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.4, color: amPhotoChip.glass.fg, fontVariant: ["tabular-nums"] },
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
