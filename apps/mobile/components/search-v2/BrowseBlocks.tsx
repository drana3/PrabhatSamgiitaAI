import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Clock, Mic, X } from "lucide-react-native"

import { AvatarFace } from "@/components/profile-v2/AvatarFace"
import { HOME_INSET, HomeCover, HomeSectionHead, HomeShelf } from "@/components/home/HomeBlocks"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import type { BrowseTile, DiscoverTag } from "@/lib/fixtures/home"
import type { KindTile } from "@/lib/searchBrowse"
import { readableTitle } from "@/lib/readableTitle"
import type { RecentPlay } from "@/stores/preferencesStore"
import { coverFor, stripColors } from "@/lib/homeShelves"
import { useT } from "@/lib/i18n"

type P = { p: AmProto }
const em = (size: number, value: number) => Math.round(size * value * 100) / 100

/** Avatar, "Search" in capitals, the mic and a close button. */
export function SearchHeader({
  p,
  initial,
  listening,
  onAvatar,
  onMic,
  onClose,
}: P & { initial: string; listening: boolean; onAvatar: () => void; onMic: () => void; onClose: () => void }) {
  const t = useT()
  return (
    <View style={s.header}>
      <TodayPress accessibilityRole="button" accessibilityLabel={t("profile.sheet.a11y")} onPress={onAvatar} pressedScale={0.97} style={[s.avatar, { backgroundColor: p.dark ? p.orange100 : p.white }]}>
        <AvatarFace initial={initial} textStyle={[s.avatarText, { color: p.orange700 }]} />
      </TodayPress>
      <Text style={[s.title, { color: p.ink800 }]} accessibilityRole="header">
        {t("home.search")}
      </Text>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={listening ? t("search.mic.stop") : t("search.mic.start")}
        accessibilityState={{ selected: listening }}
        onPress={onMic}
        pressedScale={0.92}
        style={[s.round, { backgroundColor: listening ? p.action : p.white, borderColor: listening ? p.action : p.sand300 }]}
      >
        <Mic size={20} color={listening ? p.onAction : p.ink800} strokeWidth={1.9} />
      </TodayPress>
      <TodayPress accessibilityRole="button" accessibilityLabel={t("search.close")} onPress={onClose} pressedScale={0.92} style={[s.round, { backgroundColor: p.white, borderColor: p.sand300 }]}>
        <X size={20} color={p.ink800} strokeWidth={1.9} />
      </TodayPress>
    </View>
  )
}

/** The four top tiles are app sections and take their name from the tab names; every other tile is already named. */
type TileKey = "tabs.songs" | "home.filter.stories" | "tabs.learn" | "kind.kiirtans"

const TILE_KEYS: Record<string, TileKey> = {
  songs: "tabs.songs",
  stories: "home.filter.stories",
  learn: "tabs.learn",
  kiirtans: "kind.kiirtans",
}

type TagKey = "search.tag.longing" | "search.tag.devotion" | "search.tag.surrender" | "search.tag.morning" | "search.tag.kirtan"

const TAG_KEYS: Record<string, TagKey> = {
  longing: "search.tag.longing",
  devotion: "search.tag.devotion",
  surrender: "search.tag.surrender",
  morning: "search.tag.morning",
  kirtan: "search.tag.kirtan",
}

function Tile({ p, tile, height, onPress, big, sub }: P & { tile: BrowseTile; height: number; onPress: () => void; big?: boolean; sub?: string }) {
  const t = useT()
  const { bg, fg } = stripColors(tile.tone, p.dark)
  const key = TILE_KEYS[tile.id]
  const label = key ? t(key) : tile.label
  return (
    <TodayPress accessibilityRole="button" accessibilityLabel={sub ? `${label}, ${sub}` : label} onPress={onPress} pressedScale={0.97} style={[s.tile, { height, backgroundColor: bg }]}>
      <Text style={[big ? s.tileLabelBig : s.tileLabel, !big && label.split(" ").some((w) => w.length > 9) && s.tileLabelLong, { color: fg }]} numberOfLines={big ? 1 : 2}>
        {label}
      </Text>
      {sub ? <Text style={[s.tileSub, { color: fg }]} numberOfLines={1}>{sub}</Text> : null}
      <View pointerEvents="none" style={s.art}>
        <HomeCover number={tile.cover} size={big ? 74 : 64} radius={12} />
      </View>
    </TodayPress>
  )
}

/** Two columns of tiles; `big` is the top 2 x 2 block (taller, larger labels). */
export function TileGrid({ p, tiles, big, subOf, onPick }: P & { tiles: readonly BrowseTile[]; big?: boolean; subOf?: (tile: BrowseTile) => string | undefined; onPick: (tile: BrowseTile) => void }) {
  return (
    <View style={s.grid}>
      {tiles.map((tile) => (
        <View key={tile.id} style={s.cell}>
          <Tile p={p} tile={tile} big={big} sub={subOf?.(tile)} height={big ? 100 : 92} onPress={() => onPick(tile)} />
        </View>
      ))}
    </View>
  )
}

/** "Discover something new": tall photo cards with a #tag over a gradient. */
export function DiscoverShelf({ p, tags, onPick }: P & { tags: readonly DiscoverTag[]; onPick: (tag: DiscoverTag) => void }) {
  const t = useT()
  const tagLabel = (tg: DiscoverTag) => (TAG_KEYS[tg.id] ? t(TAG_KEYS[tg.id]) : tg.tag)
  return (
    <View style={s.discover}>
      <HomeSectionHead p={p} eyebrow={t("search.discover.eyebrow")} first={t("search.discover.first")} second={t("search.discover.second")} />
      <HomeShelf itemWidth={150} gap={10}>
        {tags.map((tg) => (
          <TodayPress key={tg.id} accessibilityRole="button" accessibilityLabel={t("search.tag.a11y", { tag: tagLabel(tg) })} onPress={() => onPick(tg)} pressedScale={0.97} style={s.tall}>
            <HomeCover id={coverFor(tg.cover)} width={150} height={214} radius={0} />
            <LinearGradient pointerEvents="none" colors={["rgba(10, 14, 8, 0.05)", "rgba(10, 14, 8, 0.82)"]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
            <Text style={[s.tag, tagLabel(tg).length > 9 && s.tagLong]}>{tagLabel(tg)}</Text>
          </TodayPress>
        ))}
      </HomeShelf>
    </View>
  )
}

/** Recent searches as chips (real data only). */
export function RecentRow({ p, items, onPick, onClear }: P & { items: readonly string[]; onPick: (q: string) => void; onClear: () => void }) {
  const t = useT()
  if (!items.length) return null
  return (
    <View style={s.recents}>
      <View style={s.recentsHead}>
        <Text style={[overStyle, { color: p.orange700 }]}>{t("search.recent")}</Text>
        <TodayPress accessibilityRole="button" accessibilityLabel={t("search.recent.clear.a11y")} onPress={onClear} pressedScale={0.95} style={s.clear}>
          <Text style={[s.clearText, { color: p.ink500 }]}>{t("common.clear")}</Text>
        </TodayPress>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentChips}>
        {items.map((q) => (
          <TodayPress key={q} accessibilityRole="button" accessibilityLabel={t("search.recent.item.a11y", { query: q })} onPress={() => onPick(q)} pressedScale={0.95} style={[s.recent, { backgroundColor: p.white, borderColor: p.sand300 }]}>
            <Clock size={16} color={p.ink500} />
            <Text style={[s.recentText, { color: p.ink800 }]} numberOfLines={1}>
              {q}
            </Text>
          </TodayPress>
        ))}
      </ScrollView>
    </View>
  )
}

/**
 * "Recently played": the songs this person played last on this device (the app's own history, up to 12; it
 * keeps no play counts, so there is no "most played"). Hidden while the history is empty. A card opens the song.
 */
export function RecentPlaysShelf({ p, items, onPick }: P & { items: readonly RecentPlay[]; onPick: (play: RecentPlay) => void }) {
  const t = useT()
  if (!items.length) return null
  return (
    <View style={s.recents}>
      <View style={s.recentsHead}>
        <Text style={[overStyle, { color: p.orange700 }]}>{t("search.played.title")}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentChips}>
        {items.map((play) => (
          <TodayPress
            key={play.id}
            accessibilityRole="button"
            accessibilityLabel={t("search.played.a11y", { number: String(play.number), title: play.title })}
            onPress={() => onPick(play)}
            pressedScale={0.97}
            style={[s.played, { backgroundColor: p.white, borderColor: p.sand300 }]}
          >
            <Text style={[overStyle, { color: p.orange700 }]}>PS {play.number}</Text>
            <Text style={[s.playedTitle, { color: p.ink800 }]} numberOfLines={2}>
              {readableTitle(play.title)}
            </Text>
          </TodayPress>
        ))}
      </ScrollView>
    </View>
  )
}

/** The whole empty-field view: top tiles, Discover, Browse all. */
export function BrowseView({
  p,
  top,
  discover,
  all,
  recents,
  played,
  onTile,
  onTag,
  onRecent,
  onClearRecents,
  onPlayed,
}: P & {
  top: readonly BrowseTile[]
  discover: readonly DiscoverTag[]
  all: readonly KindTile[]
  recents: readonly string[]
  played: readonly RecentPlay[]
  onTile: (tile: BrowseTile) => void
  onTag: (tag: DiscoverTag) => void
  onRecent: (q: string) => void
  onClearRecents: () => void
  onPlayed: (play: RecentPlay) => void
}) {
  const t = useT()
  const { width } = useWindowDimensions()
  void width
  return (
    <View style={s.browse}>
      <RecentRow p={p} items={recents} onPick={onRecent} onClear={onClearRecents} />
      <TileGrid p={p} tiles={top} big onPick={onTile} />
      <RecentPlaysShelf p={p} items={played} onPick={onPlayed} />
      {discover.length ? <DiscoverShelf p={p} tags={discover} onPick={onTag} /> : null}
      <View style={s.discover}>
        <HomeSectionHead p={p} eyebrow={t("search.browse.eyebrow")} first={t("search.browse.first")} second={t("search.browse.second")} />
        <TileGrid p={p} tiles={all} subOf={(tile) => t("songs.collections.count", { count: (tile as KindTile).count })} onPick={onTile} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: HOME_INSET - 4, paddingRight: HOME_INSET - 4, paddingTop: 6, paddingBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: amFonts.display, fontSize: 18, lineHeight: 26 },
  title: { flex: 1, fontFamily: amFonts.display, fontSize: 30, lineHeight: 34, letterSpacing: em(30, -0.02), textTransform: "uppercase", marginLeft: 4 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  browse: { gap: 36, paddingTop: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: HOME_INSET - 5 },
  cell: { width: "50%", padding: 5 },
  tile: { borderRadius: 20, overflow: "hidden", padding: 14 },
  tileLabel: { fontFamily: amFonts.display, fontSize: 18, lineHeight: 22, letterSpacing: em(18, -0.01), maxWidth: "70%" },
  // one long word (Настроения, Инструменты) must not break across lines
  tileLabelLong: { fontSize: 15, lineHeight: 19, letterSpacing: em(15, -0.01) },
  tileSub: { marginTop: 4, maxWidth: "70%", fontFamily: amFonts.medium, fontSize: 13, lineHeight: 16, opacity: 0.86 },
  tileLabelBig: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 24, letterSpacing: em(20, -0.01), textTransform: "uppercase" },
  art: { position: "absolute", right: -10, bottom: -8, transform: [{ rotate: "22deg" }], opacity: 0.96 },
  discover: { gap: 16 },
  tall: { width: 150, height: 214, borderRadius: 22, overflow: "hidden", justifyContent: "flex-end", padding: 14 },
  tag: { fontFamily: amFonts.display, fontSize: 21, lineHeight: 24, letterSpacing: em(21, -0.01), color: "#FFFFFF" },
  // longer words (Russian, Spanish) must fit the 122dp inside the card on one line
  tagLong: { fontSize: 16, lineHeight: 20, letterSpacing: em(16, -0.01) },
  recents: { gap: 10 },
  recentsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: HOME_INSET },
  clear: { height: 32, paddingHorizontal: 8, justifyContent: "center" },
  clearText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  played: { width: 168, minHeight: 84, borderRadius: 20, borderWidth: 1, padding: 14, gap: 4, justifyContent: "center" },
  playedTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  recentChips: { gap: 8, paddingHorizontal: HOME_INSET },
  recent: { height: 40, paddingHorizontal: 14, borderRadius: 70, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 220 },
  recentText: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20, flexShrink: 1 },
})
