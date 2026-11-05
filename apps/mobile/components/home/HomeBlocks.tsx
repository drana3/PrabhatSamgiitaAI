import { useRef, type ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Bell, MoreHorizontal, Search } from "lucide-react-native"

import { AvatarFace } from "@/components/profile-v2/AvatarFace"
import { HOME_COVERS, HOME_COVER_FOCUS } from "@/components/home/homeCovers"
import { PlayGlyph } from "@/components/today/protoIcons"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { todayAssets } from "@/constants/todayAssets"
import { amPhotoChip, amScrimPhoto, amScrimPhotoTop } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { chunk, coverFor, type HomeCoverId, type StripTone } from "@/lib/homeShelves"
import type { TodayDayKind } from "@/lib/todayDay"

type P = { p: AmProto }

/** Left and right inset of headings, rows and the start of every shelf. */
export const HOME_INSET = 20
const PRESS = 0.97
const em = (size: number, value: number) => Math.round(size * value * 100) / 100

/* ------------------------------------------------------------------- pictures */

/** A cover picture, cropped to its subject. `number` picks one for a song. */
export function HomeCover({
  id,
  number,
  size,
  width,
  height,
  radius,
  style,
}: {
  id?: HomeCoverId
  number?: number
  size?: number
  width?: number
  height?: number
  radius: number
  style?: object
}) {
  const cover = id ?? coverFor(number ?? 0)
  return (
    <Image
      source={HOME_COVERS[cover]}
      contentFit="cover"
      contentPosition={HOME_COVER_FOCUS[cover]}
      accessibilityIgnoresInvertColors
      style={[{ width: width ?? size, height: height ?? size, borderRadius: radius }, style]}
    />
  )
}

/* ------------------------------------------------------------------ top row */

/** Row 1, scrolls away: avatar on the left, search and bell on the right, nothing between. A small orange dot says something is unread. */
export function HomeTopRow({
  p,
  initial,
  unread,
  onAvatar,
  onBell,
  onSearch,
}: P & { initial: string; unread: boolean; onAvatar: () => void; onBell: () => void; onSearch: () => void }) {
  return (
    <View style={s.topRow}>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel="Profile and settings"
        onPress={onAvatar}
        pressedScale={PRESS}
        style={[s.avatar, { backgroundColor: p.dark ? p.orange100 : p.white }]}
      >
        <AvatarFace initial={initial} textStyle={[s.avatarText, { color: p.orange700 }]} />
      </TodayPress>
      <View style={s.spacer} />
      <TodayPress accessibilityRole="search" accessibilityLabel="Search" onPress={onSearch} pressedScale={PRESS} style={[s.round, { backgroundColor: p.white, borderColor: p.sand300 }]}>
        <Search size={20} color={p.ink800} strokeWidth={1.9} />
      </TodayPress>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={unread ? "Notifications, unread" : "Notifications"}
        onPress={onBell}
        pressedScale={PRESS}
        style={[s.round, { backgroundColor: p.white, borderColor: p.sand300 }]}
      >
        <Bell size={20} color={p.ink800} strokeWidth={1.9} />
        {unread ? <View style={[s.dot, { backgroundColor: p.orange500, borderColor: p.white }]} /> : null}
      </TodayPress>
    </View>
  )
}

/* ---------------------------------------------------------------- section head */

/** Eyebrow, then the two-tone capitals heading. */
export function HomeSectionHead({ p, eyebrow, first, second, action }: P & { eyebrow: string; first: string; second: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={s.headRow}>
      <View style={s.head}>
        <Text style={[overStyle, { color: p.orange700 }]} numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text style={s.h2} accessibilityRole="header">
          <Text style={{ color: p.ink800 }}>{first}</Text>
          {"\n"}
          <Text style={{ color: p.ink300 }}>{second}</Text>
        </Text>
      </View>
      {action ? (
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          pressedScale={0.95}
          style={[s.action, { backgroundColor: p.ink900 }]}
        >
          <Text style={[s.actionText, { color: p.onInk }]}>{action.label}</Text>
        </TodayPress>
      ) : null}
    </View>
  )
}

/* ------------------------------------------------------------- today hero card */

/** Chips on a photograph are neutral only: dark glass + white text, whatever kind of day it is. */
const KIND = (_p: AmProto, _kind: TodayDayKind) => amPhotoChip.glass

/**
 * The song of the day: photo, the date, what kind of day it is ("Composed on this day", a festival,
 * a season), the title and a play button. The Today prototype's hero, shortened to fit a shelf page.
 */
export function HomeTodayCard({
  p,
  dateLabel,
  kind,
  kindLabel,
  note,
  meta,
  title,
  playing,
  onOpen,
  onListen,
}: P & {
  dateLabel: string
  kind: TodayDayKind
  kindLabel: string
  note?: string | null
  meta: string
  title: string
  playing: boolean
  onOpen: () => void
  onListen: () => void
}) {
  const chip = KIND(p, kind)
  return (
    <View style={[s.today, { backgroundColor: p.sage900 }]}>
      <Image source={todayAssets.hero} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: 0, left: "50%" }} accessibilityIgnoresInvertColors />
      <LinearGradient pointerEvents="none" colors={[amScrimPhotoTop[0], amScrimPhotoTop[1], amScrimPhoto[1]]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.todayTop}>
        <Text style={[overStyle, { color: "#FFFFFF" }]}>{dateLabel}</Text>
        <View style={[s.kindChip, { backgroundColor: chip.bg }]}>
          <Text style={[s.kindText, { color: chip.fg }]}>{kindLabel}</Text>
        </View>
      </View>
      <View style={s.todayBottom}>
        <TodayPress accessibilityRole="button" accessibilityLabel={`Read lyrics of ${title}`} onPress={onOpen} pressedScale={PRESS} style={s.todayMain}>
          <Text style={[overStyle, { color: "#FFFFFF" }]} numberOfLines={1}>
            {meta}
          </Text>
          <Text style={s.todayTitle} numberOfLines={2}>
            {title}
          </Text>
          {note ? (
            <Text style={s.todayNote} numberOfLines={2}>
              {note}
            </Text>
          ) : null}
        </TodayPress>
        <TodayPress accessibilityRole="button" accessibilityLabel={`${playing ? "Pause" : "Listen to"} ${title}`} onPress={onListen} pressedScale={PRESS} style={[s.play, { backgroundColor: p.action }]}>
          <PlayGlyph size={24} color={p.onAction} />
        </TodayPress>
      </View>
    </View>
  )
}

/* ------------------------------------------------------------ start listening */

export type HomeRowData = { number: number; title: string; sub: string }

/** One compact row: 48dp cover, title, `PS 3 · 4:31`, the more button. */
export function HomeRow({ p, row, rank, onOpen, onMore }: P & { row: HomeRowData; rank?: number; onOpen: () => void; onMore: () => void }) {
  return (
    <View style={[s.row, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      <TodayPress accessibilityRole="button" accessibilityLabel={`${row.sub}, ${row.title}`} onPress={onOpen} pressedScale={0.985} style={s.rowMain}>
        {rank != null ? <Text style={[s.rank, { color: p.orange700 }]}>{rank}</Text> : null}
        <HomeCover number={row.number} size={48} radius={10} />
        <View style={s.rowText}>
          <Text style={[s.rowTitle, { color: p.ink800 }]} numberOfLines={1}>
            {row.title}
          </Text>
          <Text style={[s.rowSub, { color: p.ink500 }]} numberOfLines={1}>
            {row.sub}
          </Text>
        </View>
      </TodayPress>
      <TodayPress accessibilityRole="button" accessibilityLabel={`More actions for ${row.title}`} onPress={onMore} pressedScale={0.88} style={s.more}>
        <MoreHorizontal size={22} color={p.ink500} />
      </TodayPress>
    </View>
  )
}

/** Rows in pages of three. Swiping snaps to the next page; a strip of it shows at the right edge. */
export function HomePagedRows({
  p,
  rows,
  onOpen,
  onMore,
}: P & { rows: readonly HomeRowData[]; onOpen: (row: HomeRowData) => void; onMore: (row: HomeRowData) => void }) {
  const { width } = useWindowDimensions()
  const pages = chunk(rows, 3)
  const pageWidth = pages.length > 1 ? width - HOME_INSET - 36 : width - 2 * HOME_INSET
  const gap = 10
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={pageWidth + gap}
      snapToAlignment="start"
      decelerationRate="fast"
      contentContainerStyle={{ paddingLeft: HOME_INSET, paddingRight: HOME_INSET, gap }}
    >
      {pages.map((page, i) => (
        <View key={i} style={[s.page, { width: pageWidth }]}>
          {page.map((row) => (
            <HomeRow key={row.number} p={p} row={row} onOpen={() => onOpen(row)} onMore={() => onMore(row)} />
          ))}
        </View>
      ))}
    </ScrollView>
  )
}

/* ------------------------------------------------------------- strip cards */

export type StripCardData = {
  id: string
  /** text on the coloured strip */
  label: string
  tone: StripTone
  cover: number | HomeCoverId
  /** a stock photo (`StockPhoto.cover`); when set it is shown instead of `cover` */
  photo?: number
  title?: string
  caption: string
}

/** A square (or wide) picture with a coloured label strip across the bottom and a caption under it. */
export function StripCard({
  p,
  card,
  width,
  height,
  onPress,
}: P & { card: StripCardData; width: number; height?: number; onPress: () => void }) {
  const id = typeof card.cover === "number" ? coverFor(card.cover) : card.cover
  const picture = height ?? width
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel={`${card.label}${card.title ? `, ${card.title}` : ""}. ${card.caption}`}
      onPress={onPress}
      pressedScale={PRESS}
      style={{ width }}
    >
      <View style={[s.stripPic, { width, height: picture, backgroundColor: p.sage900 }]}>
        {card.photo != null ? (
          <Image source={card.photo} contentFit="cover" accessibilityIgnoresInvertColors style={{ width, height: picture }} />
        ) : (
          <HomeCover id={id} width={width} height={picture} radius={0} />
        )}
        <LinearGradient pointerEvents="none" colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.28)"]} style={StyleSheet.absoluteFill} />
        <View style={[s.strip, { backgroundColor: amPhotoChip.glass.bg }]}>
          <Text style={[s.stripText, { color: amPhotoChip.glass.fg }]} numberOfLines={1}>
            {card.label}
          </Text>
        </View>
      </View>
      {card.title ? (
        <Text style={[s.cardTitle, { color: p.ink800 }]} numberOfLines={2}>
          {card.title}
        </Text>
      ) : null}
      <Text style={[s.caption, { color: p.ink500 }]} numberOfLines={2}>
        {card.caption}
      </Text>
    </TodayPress>
  )
}

/** A horizontal shelf of cards that snap card by card. */
export function HomeShelf({ children, itemWidth, gap = 12 }: { children: ReactNode; itemWidth: number; gap?: number }) {
  const ref = useRef<ScrollView>(null)
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={itemWidth + gap}
      snapToAlignment="start"
      decelerationRate="fast"
      contentContainerStyle={{ paddingLeft: HOME_INSET, paddingRight: HOME_INSET, gap }}
    >
      {children}
    </ScrollView>
  )
}

/** "Because you listened to": small square covers, title and `PS 3 · 4:31`. */
export function SquareCard({ p, row, onPress }: P & { row: HomeRowData; onPress: () => void }) {
  return (
    <TodayPress accessibilityRole="button" accessibilityLabel={`${row.sub}, ${row.title}`} onPress={onPress} pressedScale={PRESS} style={s.square}>
      <HomeCover number={row.number} size={156} radius={20} />
      <Text style={[s.cardTitle, { color: p.ink800, marginTop: 8 }]} numberOfLines={2}>
        {row.title}
      </Text>
      <Text style={[s.caption, { color: p.ink500 }]} numberOfLines={1}>
        {row.sub}
      </Text>
    </TodayPress>
  )
}

/** A short note where a shelf has nothing to show. */
export function HomeEmpty({ p, text }: P & { text: string }) {
  return <Text style={[s.empty, { color: p.ink500 }]}>{text}</Text>
}

const s = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: HOME_INSET - 4, paddingRight: HOME_INSET - 4, paddingTop: 6, paddingBottom: 10 },
  spacer: { flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: amFonts.display, fontSize: 18, lineHeight: 26 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 9, right: 10, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  headRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingRight: HOME_INSET },
  head: { flex: 1, minWidth: 0, paddingHorizontal: HOME_INSET, gap: 6 },
  action: { height: 36, paddingHorizontal: 14, borderRadius: 70, justifyContent: "center" },
  actionText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  h2: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 30, letterSpacing: em(30, -0.02), textTransform: "uppercase" },
  today: { marginHorizontal: HOME_INSET - 10, height: 232, borderRadius: 30, overflow: "hidden", padding: 16, justifyContent: "space-between" },
  todayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  kindChip: { height: 32, paddingHorizontal: 14, borderRadius: 70, justifyContent: "center" },
  kindText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  todayBottom: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  todayMain: { flex: 1, minWidth: 0, gap: 3 },
  todayTitle: { fontFamily: amFonts.display, fontSize: 26, lineHeight: 26, letterSpacing: em(26, -0.02), textTransform: "uppercase", color: "#FFFFFF" },
  todayNote: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19, color: "rgba(255, 255, 255, 0.86)", marginTop: 2 },
  play: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  page: { gap: 8 },
  row: { height: 64, borderRadius: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingLeft: 8, paddingRight: 2 },
  rowMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  rank: { width: 18, fontFamily: amFonts.display, fontSize: 20, lineHeight: 24, textAlign: "center", marginLeft: 2, marginRight: -4 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21, letterSpacing: em(16, -0.01) },
  rowSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  more: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  stripPic: { borderRadius: 24, overflow: "hidden" },
  strip: { position: "absolute", left: 0, right: 0, bottom: 0, height: 38, paddingHorizontal: 16, justifyContent: "center" },
  stripText: { fontFamily: amFonts.display, fontSize: 14, lineHeight: 18, letterSpacing: em(14, 0.06), textTransform: "uppercase" },
  cardTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21, marginTop: 10, letterSpacing: em(16, -0.01) },
  caption: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19, marginTop: 4 },
  square: { width: 156 },
  empty: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, paddingHorizontal: HOME_INSET },
})
