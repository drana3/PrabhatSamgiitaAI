import { StyleSheet, Text, View, ScrollView, type TextStyle } from "react-native"
import { Search } from "lucide-react-native"
import { BlurView } from "expo-blur"
import { Image } from "expo-image"

import { ChevronGlyph, PlayGlyph, SearchGlyph } from "@/components/today/protoIcons"
import { PressScale } from "@/components/today/motion"
import { TodayPress } from "@/components/today/TodayPress"
import { todayAssets } from "@/constants/todayAssets"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius } from "@/constants/tokens/amSpacing"
import { amProto, type AmProto } from "@/constants/tokens/amToday"
import type { TodayDayKind } from "@/lib/todayDay"

type P = { p: AmProto }

/** Letter spacing in dp from an em value. */
const em = (size: number, value: number) => Math.round(size * value * 100) / 100

const PRESS = 0.98

/** `.over`: 13 / 600, +0.08em, capitals. */
export const overStyle: TextStyle = {
  fontFamily: amFonts.semi,
  fontSize: 13,
  lineHeight: 16,
  letterSpacing: em(13, 0.08),
  textTransform: "uppercase",
  fontVariant: ["tabular-nums"],
}

/* ------------------------------------------------------------------ header */

/** `.head`: sun mark and the wordmark, 56dp high. The avatar floats above it (TodayAvatar). */
export function TodayHeader({ p }: P) {
  return (
    <View style={s.head}>
      <Image source={todayAssets.logo} style={s.logo} contentFit="contain" accessibilityIgnoresInvertColors />
      <Text style={[s.wordmark, { color: p.ink800 }]}>Prabhat Samgiita</Text>
    </View>
  )
}

/** `.avatar`: 44dp circle, top right, stays while the page scrolls. */
export function TodayAvatar({ p, initial, onPress }: P & { initial: string; onPress: () => void }) {
  // Dawn (light) uses a white disc; in the dark theme the tinted orange one.
  const bg = p.dark ? p.orange100 : p.white
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel="Profile and settings"
      onPress={onPress}
      pressedScale={PRESS}
      style={[s.avatar, { backgroundColor: bg }]}
    >
      <Text style={[s.avatarText, { color: p.orange700 }]}>{initial}</Text>
    </TodayPress>
  )
}

/** `.pillfield`: a search field, not an icon. */
export function TodaySearchField({ p, onPress, width }: P & { onPress: () => void; width?: number | `${number}%` }) {
  return (
    <TodayPress
      accessibilityRole="search"
      accessibilityLabel="Search a number, a name or a feeling"
      onPress={onPress}
      pressedScale={PRESS}
      style={[s.field, { backgroundColor: p.white, borderColor: p.sand300 }, width != null ? { width } : null]}
    >
      <SearchGlyph size={20} color={p.ink500} />
      <Text style={[s.fieldText, { color: p.ink500 }]} numberOfLines={1}>
        Search a number, a name or a feeling
      </Text>
    </TodayPress>
  )
}

/* ------------------------------------------------------------- day heading */

const KIND_COLORS = (p: AmProto, kind: TodayDayKind) =>
  kind === "fest"
    ? { bg: p.gold300, fg: p.ink900 }
    : kind === "season"
      ? { bg: p.sage200, fg: p.sage900 }
      : { bg: p.sage700, fg: "#FFFFFF" }

/** `.tdhead`: date, kind chip, "Songs for today" and an optional note. */
export function TodayHead({
  p,
  dateLabel,
  kind,
  kindLabel,
  note,
}: P & { dateLabel: string; kind: TodayDayKind; kindLabel: string; note: string }) {
  const chip = KIND_COLORS(p, kind)
  // Dawn sets the date and the note in ink; the dark theme keeps the gold eyebrow.
  const overColor = p.dark ? p.orange700 : p.ink800
  return (
    <View style={s.tdhead}>
      <Text style={[overStyle, { color: overColor }]}>{dateLabel}</Text>
      <View style={[s.kind, { backgroundColor: chip.bg }]}>
        <Text style={[s.kindText, { color: chip.fg }]}>{kindLabel}</Text>
      </View>
      <Text style={[s.h1, { color: p.ink800 }]} accessibilityRole="header">
        Songs{"\n"}
        <Text style={{ color: p.ink300 }}>for today</Text>
      </Text>
      {note ? <Text style={[s.note, { color: p.dark ? p.ink500 : p.ink800 }]}>{note}</Text> : <View style={s.noteGap} />}
    </View>
  )
}

/* -------------------------------------------------------------------- hero */

type HeroProps = P & {
  tag: string
  meta: string
  title: string
  onOpen: () => void
  onListen: () => void
  playing: boolean
}

/** `.hpanel` photograph with a glass tag, and `.herocard`, a frosted card that overlaps its bottom 60dp. */
export function TodayHeroPanel({ p, tag, meta, title, onOpen, onListen, playing }: HeroProps) {
  return (
    <View>
      <View style={[s.panel, { backgroundColor: p.sage900 }]}>
        <Image
          source={todayAssets.hero}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition={{ top: 0, left: "50%" }}
          accessibilityLabel="Shrii Shrii Anandamurti"
        />
        <View style={[s.heroTag, { borderColor: p.glassEdge }]}>
          <BlurView intensity={40} tint={p.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: p.glassStrong }]} />
          <Text style={[overStyle, { color: p.orange700 }]}>{tag}</Text>
        </View>
      </View>

      <View
        style={[
          s.heroCard,
          {
            borderColor: p.dark ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.75)",
          },
        ]}
      >
        <BlurView intensity={60} tint={p.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: p.dark ? "rgba(34, 43, 29, 0.55)" : "rgba(255, 255, 255, 0.62)" },
          ]}
        />
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel={`Read lyrics of ${title}`}
          onPress={onOpen}
          pressedScale={PRESS}
          style={s.heroMain}
        >
          <Text style={[overStyle, { color: p.orange700 }]}>{meta}</Text>
          <Text style={[s.h3, { color: p.ink800 }]}>{title}</Text>
        </TodayPress>
        <TodayPress
          accessibilityRole="button"
          accessibilityLabel={`${playing ? "Pause" : "Listen to"} ${title}`}
          onPress={onListen}
          pressedScale={PRESS}
          style={[s.playBtn, { backgroundColor: p.orange500 }]}
        >
          <PlayGlyph size={24} color="#FFFFFF" />
        </TodayPress>
      </View>
    </View>
  )
}

/* -------------------------------------------------------------------- rows */

/** `.tsong`: a pill row for one of today's songs, with the first line in italics. */
export function TodaySongPill({
  p,
  meta,
  title,
  firstLine,
  onOpen,
  onPlay,
}: P & { meta: string; title: string; firstLine: string; onOpen: () => void; onPlay: () => void }) {
  return (
    <View style={[s.songPill, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={`${meta}, ${title}`}
        onPress={onOpen}
        pressedScale={PRESS}
        style={s.songPillMain}
      >
        <Text style={[overStyle, { color: p.orange700 }]} numberOfLines={1}>
          {meta}
        </Text>
        <Text style={[s.songTitle, { color: p.ink800 }]} numberOfLines={1}>
          {title}
        </Text>
        {firstLine ? (
          <Text style={[s.firstLine, { color: p.ink500 }]} numberOfLines={1}>
            {firstLine}
          </Text>
        ) : null}
      </TodayPress>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={`Play ${title}`}
        onPress={onPlay}
        pressedScale={PRESS}
        style={[s.playSm, { backgroundColor: p.dark ? p.sage700 : p.ink900 }]}
      >
        <PlayGlyph size={22} color={p.dark ? "#FFFFFF" : p.onInk} />
      </TodayPress>
    </View>
  )
}

/** `.pill.ink.tdall`: "Play all 3". */
export function TodayPlayAll({ p, count, onPress }: P & { count: number; onPress: () => void }) {
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel={`Play all ${count}`}
      onPress={onPress}
      pressedScale={PRESS}
      style={[s.playAll, { backgroundColor: p.ink900 }]}
    >
      <PlayGlyph size={18} color={p.onInk} />
      <Text style={[s.pillText, { color: p.onInk }]}>Play all</Text>
      <Text style={[s.pillText, { color: p.onInk }]}>{count}</Text>
    </TodayPress>
  )
}

/** `.card.cardbtn`: a white card with an eyebrow, a title and a chevron. */
export function TodayCardButton({
  p,
  label,
  title,
  onPress,
}: P & { label: string; title: string; onPress: () => void }) {
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${title}`}
      onPress={onPress}
      pressedScale={PRESS}
      style={[s.cardBtn, { backgroundColor: p.white, borderColor: p.sand300 }]}
    >
      <View style={s.cardBtnMain}>
        <Text style={[overStyle, { color: p.orange700 }]}>{label}</Text>
        <Text style={[s.cardTitle, { color: p.ink800 }]}>{title}</Text>
      </View>
      <ChevronGlyph size={22} color={p.ink500} />
    </TodayPress>
  )
}

/* ---------------------------------------------------------------- sections */

/** `.t-sec-h2`: two tones, capitals, 30dp. */
export function TodaySectionHeading({ p, first, second }: P & { first: string; second: string }) {
  return (
    <Text style={s.h2} accessibilityRole="header">
      <Text style={{ color: p.ink800 }}>{first}</Text>
      {"\n"}
      <Text style={{ color: p.ink300 }}>{second}</Text>
    </Text>
  )
}

/** "Pick up where you stopped": the song, how far you got, a progress bar. */
export function TodayResumeCard({
  p,
  title,
  line,
  progress,
  onPress,
}: P & { title: string; line: string; progress: number; onPress: () => void }) {
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel={`Resume ${title}`}
      onPress={onPress}
      pressedScale={PRESS}
      style={[s.resume, { backgroundColor: p.white, borderColor: p.sand400 }]}
    >
      <Text style={[s.resumeTitle, { color: p.ink800 }]}>{title}</Text>
      <Text style={[s.resumeLine, { color: p.ink500 }]}>{line}</Text>
      <View style={[s.track, { backgroundColor: p.sand300 }]}>
        <View style={[s.trackFill, { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 1000) / 10}%`, backgroundColor: p.orange500 }]} />
      </View>
    </TodayPress>
  )
}

/** Three tiles that open search with an example, in a sideways row. */
export function TodayQuickTiles({
  p,
  tiles,
  onPress,
}: P & {
  tiles: ReadonlyArray<{ id: string; label: string; example: string; query: string }>
  onPress: (query: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.tiles}
      accessibilityRole="list"
    >
      {tiles.map((tile, index) => {
        const look = tileLook(p, index)
        return (
          <TodayPress
            key={tile.id}
            accessibilityRole="button"
            accessibilityLabel={`Search by ${tile.label.toLowerCase()}, for example ${tile.example}`}
            onPress={() => onPress(tile.query)}
            pressedScale={PRESS}
            style={[s.tile, { backgroundColor: look.bg }]}
          >
            <View style={s.tileCopy}>
              <Text style={[overStyle, { color: look.over }]}>{tile.label}</Text>
              <Text style={[s.tileTitle, { color: look.fg }]}>{tile.example}</Text>
            </View>
            <ChevronGlyph size={22} color={look.chev} />
          </TodayPress>
        )
      })}
    </ScrollView>
  )
}

/** Dawn tile colours: peach, olive, forest. Dark keeps every tile readable on dark. */
function tileLook(p: AmProto, index: number) {
  if (index === 0) return { bg: p.orange100, fg: p.ink800, over: p.orange700, chev: p.ink500 }
  if (index === 1) {
    return p.dark
      ? { bg: p.olive700, fg: "#FFFFFF", over: p.gold300, chev: "#FFFFFF" }
      : { bg: p.olive100, fg: p.ink800, over: p.orange700, chev: p.ink500 }
  }
  return { bg: p.sage700, fg: "#FFFFFF", over: p.gold300, chev: "#FFFFFF" }
}

/** `.lcard.olive`: the story of the week. */
export function TodayStoryCard({
  p,
  label,
  title,
  blurb,
  onPress,
}: P & { label: string; title: string; blurb: string; onPress: () => void }) {
  const bg = p.dark ? p.sage700 : p.sage200
  const fg = p.dark ? "#FFFFFF" : p.sage900
  const over = p.dark ? p.gold300 : p.sage700
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityLabel={`Story of the week: ${title}`}
      onPress={onPress}
      pressedScale={PRESS}
      style={[s.story, { backgroundColor: bg }]}
    >
      <Text style={[overStyle, { color: over }]}>{label}</Text>
      <Text style={[s.storyTitle, { color: fg }]}>{title}</Text>
      {blurb ? <Text style={[s.storyBlurb, { color: fg }]}>{blurb}</Text> : null}
    </TodayPress>
  )
}

/** `.song` in "Recently played": a ruled row, the length on the right when it is known. */
export function TodayRecentRow({
  p,
  number,
  title,
  length,
  onPress,
}: P & { number: number | string; title: string; length?: string; onPress: () => void }) {
  return (
    <View style={[s.recent, { borderBottomColor: p.sand400 }]}>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={`PS ${number}, ${title}`}
        onPress={onPress}
        pressedScale={PRESS}
        style={s.recentMain}
      >
        <Text style={[overStyle, { color: p.orange700 }]}>PS {number}</Text>
        <Text style={[s.songTitle, { color: p.ink800 }]} numberOfLines={1}>
          {title}
        </Text>
      </TodayPress>
      {length ? <Text style={[s.recentLength, { color: p.ink500 }]}>{length}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  head: {
    height: amProto.headHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: amProto.gutter,
  },
  logo: { width: 30, height: 36 },
  wordmark: {
    fontFamily: amFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: em(13, 0.08),
    textTransform: "uppercase",
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 26 },
  field: {
    marginHorizontal: amProto.gutter,
    height: amProto.pillField,
    borderRadius: 70,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  fieldText: { flex: 1, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 19 },
  tdhead: { paddingTop: 12, paddingBottom: 18, paddingHorizontal: 20, gap: 8 },
  kind: {
    alignSelf: "flex-start",
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 9999,
    justifyContent: "center",
  },
  kindText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18, letterSpacing: em(14, -0.005) },
  h1: {
    fontFamily: amFonts.display,
    fontSize: 45,
    lineHeight: 45,
    letterSpacing: em(45, -0.02),
    textTransform: "uppercase",
  },
  note: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20, maxWidth: 256 },
  /** the prototype's empty note still takes its 8dp gap */
  noteGap: { height: 0 },
  panel: {
    marginHorizontal: amProto.gutter,
    height: amProto.hero,
    borderRadius: 30,
    overflow: "hidden",
  },
  heroTag: {
    position: "absolute",
    left: 14,
    top: 14,
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 70,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  heroCard: {
    marginTop: -amProto.heroOverlap,
    marginHorizontal: 22,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 20,
    paddingRight: 14,
  },
  heroMain: { flex: 1, gap: 6 },
  h3: {
    fontFamily: amFonts.display,
    fontSize: 22,
    lineHeight: 22,
    letterSpacing: em(22, -0.02),
    textTransform: "uppercase",
  },
  playBtn: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  songPill: {
    minHeight: 76,
    borderRadius: 70,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingLeft: 28,
    paddingRight: 12,
  },
  songPillMain: { flex: 1, minWidth: 0, gap: 3 },
  songTitle: {
    fontFamily: amFonts.semi,
    fontSize: 19,
    lineHeight: 22,
    letterSpacing: em(19, -0.01),
  },
  firstLine: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19, fontStyle: "italic" },
  playSm: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  playAll: {
    alignSelf: "flex-start",
    marginTop: 4,
    height: amProto.pillHeight,
    paddingHorizontal: 24,
    borderRadius: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pillText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  cardBtn: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 20,
    paddingRight: 16,
  },
  cardBtnMain: { flex: 1, minWidth: 0, gap: 4 },
  cardTitle: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 22, letterSpacing: em(19, -0.01) },
  h2: {
    fontFamily: amFonts.display,
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: em(30, -0.02),
    textTransform: "uppercase",
    paddingHorizontal: amProto.gutter,
  },
  resume: { borderRadius: 30, borderWidth: 1, padding: 20 },
  resumeTitle: {
    fontFamily: amFonts.display,
    fontSize: 26,
    lineHeight: 27,
    letterSpacing: em(26, -0.02),
    textTransform: "uppercase",
  },
  resumeLine: {
    fontFamily: amFonts.medium,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 14,
    fontVariant: ["tabular-nums"],
  },
  track: { height: 6, borderRadius: 9999, overflow: "hidden" },
  trackFill: { height: 6, borderRadius: 9999 },
  tiles: { gap: 10, paddingHorizontal: amProto.gutter },
  tile: {
    width: 168,
    minHeight: 150,
    borderRadius: 30,
    padding: 20,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tileCopy: { gap: 4 },
  tileTitle: { fontFamily: amFonts.semi, fontSize: 20, lineHeight: 23, letterSpacing: em(20, -0.01) },
  story: { borderRadius: 30, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 22, gap: 12 },
  storyTitle: {
    fontFamily: amFonts.display,
    fontSize: 22,
    lineHeight: 22,
    letterSpacing: em(22, -0.02),
    textTransform: "uppercase",
  },
  storyBlurb: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  recent: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingLeft: 4,
    paddingRight: 10,
    borderBottomWidth: 1,
  },
  recentMain: { flex: 1, minWidth: 0, gap: 4 },
  recentLength: { width: 44, textAlign: "right", paddingRight: 10, fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20, fontVariant: ["tabular-nums"] },
})

/* ------------------------------------------------- legacy exports used by other areas */
// Songs and Learn still import these two from here. Kept unchanged until those areas move to their own blocks.

/** A field, not an icon: users did not find the old search icon. */
export function TodaySearchPill({ theme, onPress }: { theme: AmTheme; onPress: () => void }) {
  return (
    <PressScale
      accessibilityRole="search"
      accessibilityLabel="Search a number, a name or a feeling"
      onPress={onPress}
      pressedScale={0.985}
      style={[legacy.search, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <Search size={20} color={theme.textBody} />
      <Text style={[amType.body, { color: theme.textMuted }]} numberOfLines={1}>
        Search a number, a name or a feeling
      </Text>
    </PressScale>
  )
}

/** Heading in two tones: the first line in ink, the second in a lighter ink. */
export function TwoToneHeading({ theme, first, second }: { theme: AmTheme; first: string; second: string }) {
  return (
    <Text style={[amType.title, legacy.heading]} accessibilityRole="header">
      <Text style={{ color: theme.textHeading }}>{first}</Text>
      {"\n"}
      <Text style={{ color: amColors.ink300 }}>{second}</Text>
    </Text>
  )
}

const legacy = StyleSheet.create({
  search: {
    height: 56,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  heading: { marginBottom: amGap.block },
})
