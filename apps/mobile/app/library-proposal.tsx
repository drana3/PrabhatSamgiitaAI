import { useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowUpDown, ChevronLeft, ChevronRight, LayoutGrid, List, ListPlus, Plus, Search } from "lucide-react-native"

import { HOME_INSET, HomeChips, HomeCover } from "@/components/home/HomeBlocks"
import { Reveal } from "@/components/today/motion"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import { amProto, protoFor, type AmProto } from "@/constants/tokens/amToday"
import { useAmTheme } from "@/hooks/useAmTheme"
import { memberProfileName } from "@/lib/displayName"
import { HOME_LIBRARY } from "@/lib/fixtures/home"
import {
  LIBRARY_FILTERS,
  buildLibraryItems,
  filterLibrary,
  nextLayout,
  type LibraryFilterId,
  type LibraryItem,
  type LibraryLayout,
} from "@/lib/libraryProposal"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { useAuthStore } from "@/stores/authStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

function RoundButton({ p, label, onPress, children }: { p: AmProto; label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <TodayPress accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressedScale={0.92} style={[s.round, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      {children}
    </TodayPress>
  )
}

function ListRow({ p, item, onPress }: { p: AmProto; item: LibraryItem; onPress: () => void }) {
  return (
    <TodayPress accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.sub}`} onPress={onPress} pressedScale={0.985} style={s.row}>
      <HomeCover number={item.coverNumber} size={60} radius={item.kind === "playlists" ? 12 : 30} />
      <View style={s.rowText}>
        <Text style={[s.rowTitle, { color: p.ink800 }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[s.rowSub, { color: p.ink500 }]} numberOfLines={1}>
          {item.sub}
        </Text>
      </View>
    </TodayPress>
  )
}

function AddRow({ p, label, onPress }: { p: AmProto; label: string; onPress: () => void }) {
  return (
    <TodayPress accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressedScale={0.985} style={s.row}>
      <View style={[s.addTile, { borderColor: p.ink300 }]}>
        <Plus size={24} color={p.ink500} strokeWidth={1.9} />
      </View>
      <Text style={[s.rowTitle, { color: p.ink800 }]}>{label}</Text>
    </TodayPress>
  )
}

/**
 * Library proposal (additive; Songs > Mine stays as it is): playlists, downloads, saved songs and
 * what you are learning in one place, with a list/grid switch. Opened from the profile sheet in the
 * preview build. With the preview off it shows real counts.
 */
export default function LibraryProposalScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const top = insets.top || amProto.statusArea
  const [filter, setFilter] = useState<LibraryFilterId | null>(null)
  const [layout, setLayout] = useState<LibraryLayout>("list")

  const playlists = usePlaylistStore((st) => st.playlists)
  const savedSongIds = usePreferencesStore((st) => st.savedSongIds)
  const offlineFiles = useOfflineAudioStore((st) => st.files)
  const mode = useAuthStore((st) => st.mode)
  const displayName = useAuthStore((st) => st.displayName)
  const email = useAuthStore((st) => st.email)
  const overridden = useAuthStore((st) => st.displayNameOverridden)
  const initial = MOCKUP_DATA ? "D" : memberProfileName({ mode, email, displayName, displayNameOverridden: overridden }).trim().charAt(0).toUpperCase() || "·"

  // TODO(api): words due comes from the learning store once it exposes a count
  const items = useMemo(
    () =>
      MOCKUP_DATA
        ? [...HOME_LIBRARY]
        : buildLibraryItems({
            playlists: playlists.map((pl) => ({ id: pl.id, name: pl.name, count: pl.songs.length })),
            savedCount: savedSongIds.length,
            downloadCount: Object.keys(offlineFiles).length,
            wordsDue: 0,
          }),
    [playlists, savedSongIds, offlineFiles],
  )
  const shown = filterLibrary(items, filter)
  const toggleFilter = (id: LibraryFilterId) => setFilter((cur) => (cur === id ? null : id))
  const open = (item: LibraryItem) => router.push(href(item.target))
  const addPlaylist = () => router.push(href("/playlist/add"))
  const cell = (width - 2 * HOME_INSET - 12) / 2

  const back = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/today")))

  return (
    <View style={[s.root, { backgroundColor: p.sand200, paddingTop: top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <Reveal index={0}>
          <View style={s.header}>
            <RoundButton p={p} label="Back" onPress={back}>
              <ChevronLeft size={22} color={p.ink800} strokeWidth={1.9} />
            </RoundButton>
            <View style={[s.avatar, { backgroundColor: p.dark ? p.orange100 : p.white }]} accessibilityLabel="Your profile">
              <Text style={[s.avatarText, { color: p.orange700 }]}>{initial}</Text>
            </View>
            <View style={s.grow} />
            <RoundButton p={p} label="Search" onPress={() => router.push(href("/search-v2?focus=1"))}>
              <Search size={20} color={p.ink800} strokeWidth={1.9} />
            </RoundButton>
            <RoundButton p={p} label="Add a playlist" onPress={addPlaylist}>
              <Plus size={22} color={p.ink800} strokeWidth={1.9} />
            </RoundButton>
          </View>
          <Text style={s.h1} accessibilityRole="header">
            <Text style={{ color: p.ink800 }}>Your</Text>
            {"\n"}
            <Text style={{ color: p.ink300 }}>library</Text>
          </Text>
        </Reveal>

        <Reveal index={1}>
          <HomeChips p={p} chips={LIBRARY_FILTERS} value={filter} onChange={toggleFilter} inset={HOME_INSET} />
        </Reveal>

        <Reveal index={2} style={s.sortRow}>
          <TodayPress accessibilityRole="button" accessibilityLabel="Sorted by recents" onPress={() => undefined} pressedScale={0.97} style={s.sort}>
            <ArrowUpDown size={18} color={p.ink800} strokeWidth={1.9} />
            <Text style={[s.sortText, { color: p.ink800 }]}>Recents</Text>
          </TodayPress>
          <TodayPress
            accessibilityRole="button"
            accessibilityLabel={layout === "list" ? "Show as a grid" : "Show as a list"}
            onPress={() => setLayout(nextLayout(layout))}
            pressedScale={0.88}
            style={s.layoutButton}
          >
            {layout === "list" ? <LayoutGrid size={22} color={p.ink800} strokeWidth={1.9} /> : <List size={22} color={p.ink800} strokeWidth={1.9} />}
          </TodayPress>
        </Reveal>

        <Reveal index={3} style={s.bannerWrap}>
          <TodayPress accessibilityRole="button" accessibilityLabel="Bring your own playlist" onPress={addPlaylist} pressedScale={0.98} style={[s.banner, { backgroundColor: p.dark ? p.sage800 : p.sage900 }]}>
            <View style={[s.bannerTile, { backgroundColor: p.gold300 }]}>
              <ListPlus size={24} color="#1E1E1E" strokeWidth={1.9} />
            </View>
            <View style={s.rowText}>
              <Text style={s.bannerTitle}>Bring your own playlist</Text>
              <Text style={s.bannerSub}>Add songs by number, or from a list you keep</Text>
            </View>
            <ChevronRight size={22} color="#FFFFFF" />
          </TodayPress>
        </Reveal>

        <Reveal index={4}>
          {layout === "list" ? (
            <View style={s.list}>
              {shown.map((item) => (
                <ListRow key={item.id} p={p} item={item} onPress={() => open(item)} />
              ))}
              <AddRow p={p} label="Add playlist" onPress={addPlaylist} />
              <AddRow p={p} label="Add songs" onPress={() => router.push(href("/songs-v2"))} />
            </View>
          ) : (
            <View style={s.grid}>
              {shown.map((item) => (
                <TodayPress key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.sub}`} onPress={() => open(item)} pressedScale={0.97} style={{ width: cell }}>
                  <HomeCover number={item.coverNumber} size={cell} radius={20} />
                  <Text style={[s.cardTitle, { color: p.ink800 }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[s.rowSub, { color: p.ink500 }]} numberOfLines={1}>
                    {item.sub}
                  </Text>
                </TodayPress>
              ))}
              <TodayPress accessibilityRole="button" accessibilityLabel="Add playlist" onPress={addPlaylist} pressedScale={0.97} style={{ width: cell }}>
                <View style={[s.addSquare, { width: cell, height: cell, borderColor: p.ink300 }]}>
                  <Plus size={32} color={p.ink500} strokeWidth={1.9} />
                </View>
                <Text style={[s.cardTitle, { color: p.ink800 }]}>Add playlist</Text>
              </TodayPress>
            </View>
          )}
        </Reveal>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 140, gap: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: HOME_INSET - 4, height: 56 },
  grow: { flex: 1 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: amFonts.display, fontSize: 18, lineHeight: 26 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 43, letterSpacing: -0.9, textTransform: "uppercase", paddingHorizontal: HOME_INSET, paddingTop: 8 },
  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: HOME_INSET - 6 },
  sort: { height: 44, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  sortText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  layoutButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  bannerWrap: { paddingHorizontal: 10 },
  banner: { minHeight: 84, borderRadius: 26, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingLeft: 14, paddingRight: 18 },
  bannerTile: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  bannerTitle: { fontFamily: amFonts.display, fontSize: 17, lineHeight: 20, textTransform: "uppercase", letterSpacing: -0.2, color: "#FFFFFF" },
  bannerSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19, color: "rgba(255, 255, 255, 0.78)" },
  list: { paddingHorizontal: HOME_INSET, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  rowSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  addTile: { width: 60, height: 60, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: HOME_INSET, rowGap: 18 },
  cardTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 21, marginTop: 8 },
  addSquare: { borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
})
