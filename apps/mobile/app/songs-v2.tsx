import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Platform, StyleSheet, Text, View } from "react-native"
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { FilterSheet, RowMenuSheet, SortSheet } from "@/components/songs-v2/CatalogSheets"
import { CollectionsShelf } from "@/components/songs-v2/CollectionsShelf"
import { MineSegment, type MinePlaylist } from "@/components/songs-v2/MineSegment"
import { Press } from "@/components/songs-v2/Press"
import { SongCardRow } from "@/components/songs-v2/SongCardRow"
import { SongsScroller } from "@/components/songs-v2/SongsScroller"
import { Toast } from "@/components/songs-v2/Toast"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import { amFonts } from "@/constants/tokens/amTypography"
import { collectionCount } from "@/data/collections"
import { songNumbersForCategory } from "@/lib/categorySongs"
import { useProfileInitial } from "@/hooks/useProfileInitial"
import { useCatalogController } from "@/hooks/useCatalogController"
import { useOfflineStorageItems } from "@/hooks/useOfflineStorageItems"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongsV2Actions } from "@/hooks/useSongsV2Actions"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { formatBytes, totalBytes } from "@/lib/storageCache"
import { SPECIAL_TILES, tilesWithCounts } from "@/lib/songsV2/collections"
import { EMPTY_FILTERS } from "@/lib/songsV2/filters"
import { buildSavedRows, downloadsSummary } from "@/lib/songsV2/mine"
import { buildQuickStartPlan } from "@/lib/songsV2/quickStart"
import { starterSongForNumber } from "@/lib/playPlaylist"
import { usePlayerStore } from "@/stores/playerStore"
import { NAV_V2_PLAYER_ROUTE } from "@/lib/navV2"
import { legacySourceRedirect, parseSongChip, type SongChipId } from "@/lib/songsV2/segments"
import { sortOption, type ListRow } from "@/lib/songsV2/sort"
import { useAuthStore } from "@/stores/authStore"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { MOCK_OFFLINE, MOCK_PLAYLISTS } from "@/lib/fixtures/songsMock"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"

/** The catalog is 5,018 songs; shown until the list has loaded. */
const CATALOG_SIZE = 5018

/**
 * Songs: Prabhat Samgiita only, with ONE navigation layer. A pinned search pill, a chips row (All,
 * Saved, Downloaded, Playlists), and under All the Collections shelf, then "All songs" with the
 * sort bar, the list and the A-Z rail. Kiirtans have their own tab.
 */
function PsSongs() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  // The phone-frame preview on the web draws the 54px status area of the board.
  const inset = Platform.OS === "web" ? 54 : insets.top
  const params = useLocalSearchParams<{ chip?: string; segment?: string }>()
  const [chipId, setChipId] = useState<SongChipId>(parseSongChip(params.chip ?? params.segment))

  const catalog = useSongsV2Catalog()
  const controller = useCatalogController(catalog.entries)
  const actions = useSongsV2Actions()

  const mode = useAuthStore((s) => s.mode)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const syncingFavorites = usePreferencesStore((s) => s.syncingFavorites)
  const hydrateFavorites = usePreferencesStore((s) => s.hydrateFavoritesFromServer)
  const playlists = usePlaylistStore((s) => s.playlists)
  const playlistsLoading = usePlaylistStore((s) => s.loading)
  const hydratePlaylists = usePlaylistStore((s) => s.hydrateFromCache)
  const refreshPlaylists = usePlaylistStore((s) => s.refresh)
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist)
  const offlineFiles = useOfflineAudioStore((s) => s.files)
  const { items: downloadItems, scanned: downloadsScanned } = useOfflineStorageItems()

  useEffect(() => {
    if (params.chip || params.segment) setChipId(parseSongChip(params.chip ?? params.segment))
  }, [params.chip, params.segment])

  useFocusEffect(
    useCallback(() => {
      if (mode !== "signed_in") return
      void hydratePlaylists()
      void hydrateFavorites()
      void refreshPlaylists()
    }, [mode, hydrateFavorites, hydratePlaylists, refreshPlaylists]),
  )

  const initial = useProfileInitial()

  const savedNumbers = useMemo(
    // The preview seeds the same store (lib/playerV2/demoEngine.ts), so Mine is one list everywhere.
    () =>
      savedSongIds.flatMap((id) => {
        const match = /^ps-(\d+)$/i.exec(id)
        return match ? [Number(match[1])] : []
      }),
    [savedSongIds],
  )
  /** The circle-plus, the swipe and the row menu all open the one "Save to" sheet. */
  const toggleSave = actions.toggleSave
  const savedSet = useMemo(() => new Set(savedNumbers), [savedNumbers])
  const offlineNumbers = useMemo(() => (MOCKUP_DATA ? new Set(MOCK_OFFLINE) : new Set(Object.values(offlineFiles).map((f) => f.songNumber))), [offlineFiles])
  const savedRows = useMemo(
    () => buildSavedRows({ savedNumbers, entries: catalog.byNumber, offlineNumbers }),
    [savedNumbers, catalog.byNumber, offlineNumbers],
  )
  const minePlaylists = useMemo<MinePlaylist[]>(
    () =>
      MOCKUP_DATA
        ? MOCK_PLAYLISTS.map((p) => ({ id: p.id, name: p.name, songCount: p.songs.length }))
        : playlists.map((p) => ({ id: p.id, name: p.name, songCount: p.songs.length })),
    [playlists],
  )
  const downloadsTotal = MOCKUP_DATA
    ? "16.9 MB"
    : downloadsScanned && downloadItems.length ? formatBytes(totalBytes(downloadItems)) : downloadsSummary(Object.keys(offlineFiles).length)

  /** "Random Prabhat Samgiita": shuffles every song that has a recording, plays it and opens the player. */
  const quickStart = () => {
    const plan = buildQuickStartPlan()
    if (!plan) return
    usePlayerStore.setState({ activePlaylist: { id: "songs-v2:quick-start", name: t("songs.mine.quickTitle") } })
    usePlayerStore.getState().loadSong(starterSongForNumber(plan.start), plan.queue, "playlist")
    router.push(href(NAV_V2_PLAYER_ROUTE))
  }

  const openCollection = (id: string, title: string) =>
    router.push(href(`/songs-v2-collection?id=${encodeURIComponent(id)}&title=${encodeURIComponent(title)}`))

  const createNewPlaylist = async (name: string): Promise<string | null> => {
    if (mode !== "signed_in") {
      Alert.alert(t("account.signIn.title"), t("songs.alert.needsAccount"), [
        { text: t("common.notNow"), style: "cancel" },
        { text: t("account.signIn.title"), onPress: () => router.push(href("/signin")) },
      ])
      return t("songs.alert.signInToMake")
    }
    const result = await createPlaylist(name)
    if (isPlaylist(result)) return null
    if ("needsAuth" in result) return t("songs.alert.signInToMake")
    return result.error || t("songs.alert.makeFailed")
  }

  const { rows, filtered, sort, chip, filterCount } = controller
  const loadingList = catalog.loading && !catalog.entries.length
  const countLabel = loadingList
    ? t("songs.loading")
    : `${t("songs.count", { count: filtered.length })}${catalog.notice ? ` · ${t("songs.offlineSample")}` : ""}`

  const renderRow = useCallback(
    (row: ListRow) =>
      row.kind === "header" ? (
        <Text style={[styles.groupHeader, { color: theme.ink300 }]} accessibilityRole="header">
          {row.label}
        </Text>
      ) : (
        <SongCardRow
          theme={theme}
          entry={row.entry}
          saved={savedSet.has(row.entry.number)}
          offline={offlineNumbers.has(row.entry.number)}
          onOpen={actions.open}
          onToggleSave={toggleSave}
          onQueue={actions.queue}
          onMenu={controller.setMenuEntry}
        />
      ),
    [theme, savedSet, offlineNumbers, actions, toggleSave, controller.setMenuEntry],
  )

  const empty = loadingList ? (
    <Text style={[styles.message, { color: theme.textBody }]}>{t("songs.list.loading")}</Text>
  ) : catalog.error && !catalog.entries.length ? (
    <Press accessibilityRole="button" accessibilityLabel={t("common.tryAgain")} onPress={() => void catalog.reload()}>
      <Text style={[styles.message, { color: theme.textBody }]}>{catalog.error} {t("songs.tapRetry")}</Text>
    </Press>
  ) : (
    <View>
      <Text style={[styles.message, { color: theme.textBody }]}>{t("songs.noMatch")}</Text>
      <Press accessibilityRole="button" accessibilityLabel={t("songs.clearFilters")} onPress={controller.clearAll}>
        <Text style={[styles.clear, { color: theme.accent }]}>{t("songs.clearFilters")}</Text>
      </Press>
    </View>
  )

  const playAll = () => {
    const numbers: number[] = []
    for (const row of rows) if (row.kind === "song") numbers.push(row.entry.number)
    actions.playAll(numbers)
  }

  const shelfCollections = useMemo(
    () => tilesWithCounts(SPECIAL_TILES, (id) => songNumbersForCategory(id).length).map((tile) => ({ id: tile.browseId, label: tile.label, countLabel: tile.countLabel })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels are read through t at render
    [t],
  )

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <SongsScroller
        theme={theme}
        inset={inset}
        total={catalog.entries.length || CATALOG_SIZE}
        chip={chipId}
        onChip={setChipId}
        initial={initial}
        onOpenSearch={() => router.push(href("/search-v2?focus=1"))}
        onOpenProfile={() => router.push(href("/profile-sheet"))}
        catalog={{
          rows,
          groups: controller.groups,
          grouped: controller.grouped,
          category: sort === "cat",
          sortShort: sortOption(sort).short,
          onSort: () => controller.setSortOpen(true),
          countLabel,
          onCount: () => controller.setFilterOpen(true),
          filterCount,
          onPlayAll: playAll,
          renderRow,
          empty,
          resetKey: `${sort}|${chip}`,
        }}
        shelf={<CollectionsShelf theme={theme} collections={shelfCollections} onOpen={openCollection} onOpenAll={() => router.push(href("/collections-v2"))} />}
        body={
          <MineSegment
            theme={theme}
            only={chipId === "saved" ? "saved" : chipId === "downloaded" ? "downloaded" : "playlists"}
            savedRows={savedRows}
            savedLoading={syncingFavorites}
            playlists={minePlaylists}
            playlistsLoading={playlistsLoading && mode === "signed_in"}
            downloadCount={Object.keys(offlineFiles).length}
            downloadsTotal={downloadsTotal}
            onOpen={actions.open}
            onToggleSave={toggleSave}
            onQueue={actions.queue}
            onMenu={controller.setMenuEntry}
            onOpenPlaylist={(id) => router.push(href(`/playlist-v2/${id}`))}
            onCreatePlaylist={createNewPlaylist}
            onQuickStart={quickStart}
            onOpenDownloads={() => router.push(href("/storage"))}
          />
        }
      />

      <SortSheet
        open={controller.sortOpen}
        theme={theme}
        options={controller.sortOptions}
        value={controller.sort}
        onPick={controller.pickSort}
        onClose={() => controller.setSortOpen(false)}
      />
      <FilterSheet
        open={controller.filterOpen}
        theme={theme}
        state={controller.filters}
        languages={controller.languages}
        onChange={controller.setFilters}
        onClear={() => controller.setFilters(EMPTY_FILTERS)}
        onClose={() => controller.setFilterOpen(false)}
        resultCount={controller.filtered.length}
      />
      <RowMenuSheet
        open={Boolean(controller.menuEntry)}
        theme={theme}
        entry={controller.menuEntry}
        saved={controller.menuEntry ? savedSet.has(controller.menuEntry.number) : false}
        onQueue={actions.queue}
        onToggleSave={toggleSave}
        onShare={actions.share}
        onClose={() => controller.setMenuEntry(null)}
      />
      <Toast message={actions.toast} theme={theme} />
    </View>
  )
}

/**
 * Songs tab: Prabhat Samgiita only. Old links to the removed source switch (`?source=kirtan`,
 * `?source=mixes`) go to the Kiirtan tab. Reachable at /songs-v2 and, as the Songs tab, at /v2/songs.
 */
export default function SongsV2Screen() {
  const params = useLocalSearchParams<{ source?: string }>()
  const moved = legacySourceRedirect(params.source)
  if (moved) return <Redirect href={href(moved)} />
  return <PsSongs />
}

const styles = StyleSheet.create({
  // clips the fast-scroll rail while it waits 10px off the edge (it slides in): on the web that parked rail widened the page by 9px
  root: { flex: 1, overflow: "hidden" },
  groupHeader: {
    paddingTop: 20,
    paddingLeft: 10,
    paddingBottom: 2,
    fontFamily: amFonts.display,
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: -0.6,
    textTransform: "uppercase",
  },
  message: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23 },
  clear: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20, paddingVertical: 12 },
})
