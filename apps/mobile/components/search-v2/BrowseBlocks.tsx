import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Clock, Mic, X } from "lucide-react-native"

import { HOME_INSET, HomeCover, HomeSectionHead, HomeShelf } from "@/components/home/HomeBlocks"
import { overStyle } from "@/components/today/TodayBlocks"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import type { BrowseTile, DiscoverTag } from "@/lib/fixtures/home"
import { coverFor, stripColors } from "@/lib/homeShelves"

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
  return (
    <View style={s.header}>
      <TodayPress accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={onAvatar} pressedScale={0.97} style={[s.avatar, { backgroundColor: p.dark ? p.orange100 : p.white }]}>
        <Text style={[s.avatarText, { color: p.orange700 }]}>{initial}</Text>
      </TodayPress>
      <Text style={[s.title, { color: p.ink800 }]} accessibilityRole="header">
        Search
      </Text>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={listening ? "Stop listening" : "Search by voice"}
        accessibilityState={{ selected: listening }}
        onPress={onMic}
        pressedScale={0.92}
        style={[s.round, { backgroundColor: listening ? p.action : p.white, borderColor: listening ? p.action : p.sand300 }]}
      >
        <Mic size={20} color={listening ? p.onAction : p.ink800} strokeWidth={1.9} />
      </TodayPress>
      <TodayPress accessibilityRole="button" accessibilityLabel="Close search" onPress={onClose} pressedScale={0.92} style={[s.round, { backgroundColor: p.white, borderColor: p.sand300 }]}>
        <X size={20} color={p.ink800} strokeWidth={1.9} />
      </TodayPress>
    </View>
  )
}

function Tile({ p, tile, height, onPress, big }: P & { tile: BrowseTile; height: number; onPress: () => void; big?: boolean }) {
  const { bg, fg } = stripColors(tile.tone, p.dark)
  return (
    <TodayPress accessibilityRole="button" accessibilityLabel={tile.label} onPress={onPress} pressedScale={0.97} style={[s.tile, { height, backgroundColor: bg }]}>
      <Text style={[big ? s.tileLabelBig : s.tileLabel, { color: fg }]} numberOfLines={big ? 1 : 2}>
        {tile.label}
      </Text>
      <View pointerEvents="none" style={s.art}>
        <HomeCover number={tile.cover} size={big ? 74 : 64} radius={12} />
      </View>
    </TodayPress>
  )
}

/** Two columns of tiles; `big` is the top 2 x 2 block (taller, larger labels). */
export function TileGrid({ p, tiles, big, onPick }: P & { tiles: readonly BrowseTile[]; big?: boolean; onPick: (tile: BrowseTile) => void }) {
  return (
    <View style={s.grid}>
      {tiles.map((tile) => (
        <View key={tile.id} style={s.cell}>
          <Tile p={p} tile={tile} big={big} height={big ? 100 : 92} onPress={() => onPick(tile)} />
        </View>
      ))}
    </View>
  )
}

/** "Discover something new": tall photo cards with a #tag over a gradient. */
export function DiscoverShelf({ p, tags, onPick }: P & { tags: readonly DiscoverTag[]; onPick: (tag: DiscoverTag) => void }) {
  return (
    <View style={s.discover}>
      <HomeSectionHead p={p} eyebrow="Start from a feeling" first="Discover" second="something new" />
      <HomeShelf itemWidth={150} gap={10}>
        {tags.map((t) => (
          <TodayPress key={t.id} accessibilityRole="button" accessibilityLabel={`Search ${t.tag}`} onPress={() => onPick(t)} pressedScale={0.97} style={s.tall}>
            <HomeCover id={coverFor(t.cover)} width={150} height={214} radius={0} />
            <LinearGradient pointerEvents="none" colors={["rgba(10, 14, 8, 0.05)", "rgba(10, 14, 8, 0.82)"]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
            <Text style={s.tag}>{t.tag}</Text>
          </TodayPress>
        ))}
      </HomeShelf>
    </View>
  )
}

/** Recent searches as chips (real data only). */
export function RecentRow({ p, items, onPick, onClear }: P & { items: readonly string[]; onPick: (q: string) => void; onClear: () => void }) {
  if (!items.length) return null
  return (
    <View style={s.recents}>
      <View style={s.recentsHead}>
        <Text style={[overStyle, { color: p.orange700 }]}>Recent searches</Text>
        <TodayPress accessibilityRole="button" accessibilityLabel="Clear recent searches" onPress={onClear} pressedScale={0.95} style={s.clear}>
          <Text style={[s.clearText, { color: p.ink500 }]}>Clear</Text>
        </TodayPress>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentChips}>
        {items.map((q) => (
          <TodayPress key={q} accessibilityRole="button" accessibilityLabel={`Search ${q}`} onPress={() => onPick(q)} pressedScale={0.95} style={[s.recent, { backgroundColor: p.white, borderColor: p.sand300 }]}>
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

/** The whole empty-field view: top tiles, Discover, Browse all. */
export function BrowseView({
  p,
  top,
  discover,
  all,
  recents,
  onTile,
  onTag,
  onRecent,
  onClearRecents,
}: P & {
  top: readonly BrowseTile[]
  discover: readonly DiscoverTag[]
  all: readonly BrowseTile[]
  recents: readonly string[]
  onTile: (tile: BrowseTile) => void
  onTag: (tag: DiscoverTag) => void
  onRecent: (q: string) => void
  onClearRecents: () => void
}) {
  const { width } = useWindowDimensions()
  void width
  return (
    <View style={s.browse}>
      <RecentRow p={p} items={recents} onPick={onRecent} onClear={onClearRecents} />
      <TileGrid p={p} tiles={top} big onPick={onTile} />
      {discover.length ? <DiscoverShelf p={p} tags={discover} onPick={onTag} /> : null}
      <View style={s.discover}>
        <HomeSectionHead p={p} eyebrow="Everything in the library" first="Browse" second="all" />
        <TileGrid p={p} tiles={all} onPick={onTile} />
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
  tileLabelBig: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 24, letterSpacing: em(20, -0.01), textTransform: "uppercase" },
  art: { position: "absolute", right: -10, bottom: -8, transform: [{ rotate: "22deg" }], opacity: 0.96 },
  discover: { gap: 16 },
  tall: { width: 150, height: 214, borderRadius: 22, overflow: "hidden", justifyContent: "flex-end", padding: 14 },
  tag: { fontFamily: amFonts.display, fontSize: 21, lineHeight: 24, letterSpacing: em(21, -0.01), color: "#FFFFFF" },
  recents: { gap: 10 },
  recentsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: HOME_INSET },
  clear: { height: 32, paddingHorizontal: 8, justifyContent: "center" },
  clearText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  recentChips: { gap: 8, paddingHorizontal: HOME_INSET },
  recent: { height: 40, paddingHorizontal: 14, borderRadius: 70, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 220 },
  recentText: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20, flexShrink: 1 },
})
