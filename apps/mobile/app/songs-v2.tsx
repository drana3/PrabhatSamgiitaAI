import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Alert, Platform, StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { SOURCE_BAR_BLOCK, SOURCE_BAR_HEIGHT, SourceSwitch, type SourceId } from "@/components/kirtan/KirtanParts"
import { KirtanSegment } from "@/components/kirtan/KirtanSegment"
import { MixesSegment } from "@/components/kirtan/MixesSegment"
import { FilterSheet, RowMenuSheet, SortSheet } from "@/components/songs-v2/CatalogSheets"
import { CollectionsSegment } from "@/components/songs-v2/CollectionsSegment"
import { MineSegment, type MinePlaylist } from "@/components/songs-v2/MineSegment"
import { Press } from "@/components/songs-v2/Press"
import { SongCardRow } from "@/components/songs-v2/SongCardRow"
import { SongsScroller } from "@/components/songs-v2/SongsScroller"
import { StorySheet } from "@/components/songs-v2/StorySheet"
import { Toast } from "@/components/songs-v2/Toast"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import { songCategories } from "@/constants/categories"
import { amFonts } from "@/constants/tokens/amTypography"
import { collectionCount } from "@/data/collections"
import { mapApiStory, type StorySummary } from "@/data/stories"
import { useCatalogController } from "@/hooks/useCatalogController"
import { useOfflineStorageItems } from "@/hooks/useOfflineStorageItems"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongsV2Actions } from "@/hooks/useSongsV2Actions"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { api } from "@/lib/client"
import { memberProfileName } from "@/lib/displayName"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { formatBytes, totalBytes } from "@/lib/storageCache"
import { allCollectionsLabel } from "@/lib/songsV2/collections"
import { EMPTY_FILTERS } from "@/lib/songsV2/filters"
import { buildSavedRows, downloadsSummary } from "@/lib/songsV2/mine"
import { parseSegment, type SongSegmentId } from "@/lib/songsV2/segments"
import { sortOption, type ListRow } from "@/lib/songsV2/sort"
import { useAuthStore } from "@/stores/authStore"
import { useKirtanPlayerStore } from "@/stores/kirtanPlayerStore"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { MOCK_OFFLINE, MOCK_PLAYLISTS, MOCK_SAVED, MOCK_STORIES, MOCK_STRIP, MOCK_TOTAL, mockCountLabel } from "@/lib/fixtures/songsMock"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { href } from "@/utils/href"

/** The catalog is 5,018 songs; shown until the list has loaded. */
const CATALOG_SIZE = 5018

/**
 * Songs, Prabhat Samgiita source: `Catalog | Collections | Mine` (prototype lines 1125-1264). One
 * scroll surface with a pinned search pill, a pinned category strip, the A-Z rail, and the sort sheet.
 * `topExtra` is the height of the source switch above it (Prabhat Samgiita | Kirtan | Mixes).
 */
function PsSongs({ topExtra }: { topExtra: number }) {
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  // The phone-frame preview on the web draws the 54px status area of the board.
  const inset = (Platform.OS === "web" ? 54 : insets.top) + topExtra
  const params = useLocalSearchParams<{ segment?: string }>()
  const [segment, setSegment] = useState<SongSegmentId>(parseSegment(params.segment))

  const catalog = useSongsV2Catalog()
  const controller = useCatalogController(catalog.entries)
  const actions = useSongsV2Actions()

  const mode = useAuthStore((s) => s.mode)
  const displayName = useAuthStore((s) => s.displayName)
  const email = useAuthStore((s) => s.email)
  const displayNameOverridden = useAuthStore((s) => s.displayNameOverridden)
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

  // Preview (MOCKUP_DATA): hearts, playlists, stories and downloads of the prototype sample.
  const [mockSaved, setMockSaved] = useState<number[]>([...MOCK_SAVED])
  const [stories, setStories] = useState<StorySummary[]>(() =>
    MOCKUP_DATA
      ? MOCK_STORIES.map((s) => ({ slug: s.slug, title: s.title, author: "", url: "", teaser: "", themes: [], songNumbers: [s.song] }))
      : [],
  )
  const [storiesLoading, setStoriesLoading] = useState(!MOCKUP_DATA)
  const [openStory, setOpenStory] = useState<StorySummary | null>(null)
  const [storySheetOpen, setStorySheetOpen] = useState(false)

  useEffect(() => {
    if (params.segment) setSegment(parseSegment(params.segment))
  }, [params.segment])

  useEffect(() => {
    if (MOCKUP_DATA) return
    let active = true
    void api
      .fetchStories({ limit: 12 })
      .then((rows) => {
        if (active) setStories(rows.map(mapApiStory))
      })
      .finally(() => {
        if (active) setStoriesLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (mode !== "signed_in") return
      void hydratePlaylists()
      void hydrateFavorites()
      void refreshPlaylists()
    }, [mode, hydrateFavorites, hydratePlaylists, refreshPlaylists]),
  )

  const initial = MOCKUP_DATA ? "D" : memberProfileName({ mode, email, displayName, displayNameOverridden }).trim().charAt(0).toUpperCase() || "·"

  const savedNumbers = useMemo(
    () =>
      MOCKUP_DATA
        ? mockSaved
        : savedSongIds.flatMap((id) => {
            const match = /^ps-(\d+)$/i.exec(id)
            return match ? [Number(match[1])] : []
          }),
    [savedSongIds, mockSaved],
  )
  const toggleSave = useCallback(
    (entry: CatalogEntry) => {
      if (MOCKUP_DATA) setMockSaved((cur) => (cur.includes(entry.number) ? cur.filter((n) => n !== entry.number) : [...cur, entry.number]))
      else void actions.toggleSave(entry)
    },
    [actions],
  )
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

  const openCollection = (id: string, title: string) =>
    router.push(href(`/songs-v2-collection?id=${encodeURIComponent(id)}&title=${encodeURIComponent(title)}`))

  const createNewPlaylist = async (name: string): Promise<string | null> => {
    if (mode !== "signed_in") {
      Alert.alert("Sign in", "Playlists need an account, so they follow you to other phones.", [
        { text: "Not now", style: "cancel" },
        { text: "Sign in", onPress: () => router.push(href("/signin")) },
      ])
      return "Sign in to make a playlist."
    }
    const result = await createPlaylist(name)
    if (isPlaylist(result)) return null
    if ("needsAuth" in result) return "Sign in to make a playlist."
    return result.error || "Could not make the playlist. Try again."
  }

  const { rows, filtered, sort, chip, filterCount } = controller
  const loadingList = catalog.loading && !catalog.entries.length
  const countLabel = MOCKUP_DATA
    ? mockCountLabel(chip, filtered.length)
    : loadingList
      ? "Loading"
      : `${filtered.length.toLocaleString("en-US")} ${filtered.length === 1 ? "song" : "songs"}`

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
    <Text style={[styles.message, { color: theme.textBody }]}>Loading songs…</Text>
  ) : catalog.error && !catalog.entries.length ? (
    <Press accessibilityRole="button" accessibilityLabel="Try again" onPress={() => void catalog.reload()}>
      <Text style={[styles.message, { color: theme.textBody }]}>{catalog.error} Tap to try again.</Text>
    </Press>
  ) : (
    <View>
      <Text style={[styles.message, { color: theme.textBody }]}>No songs match.</Text>
      <Press accessibilityRole="button" accessibilityLabel="Clear filters" onPress={controller.clearAll}>
        <Text style={[styles.clear, { color: theme.accent }]}>Clear filters</Text>
      </Press>
    </View>
  )

  const playAll = () => {
    const numbers: number[] = []
    for (const row of rows) if (row.kind === "song") numbers.push(row.entry.number)
    actions.playAll(numbers)
  }

  const strip = useMemo(() => (MOCKUP_DATA ? [...MOCK_STRIP] : [{ id: "all", label: "All" }, ...songCategories.map((c) => ({ id: c.id as string, label: c.label }))]), [])

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <SongsScroller
        theme={theme}
        inset={inset}
        total={MOCKUP_DATA ? MOCK_TOTAL : catalog.entries.length || CATALOG_SIZE}
        segment={segment}
        onSegment={setSegment}
        savedCount={savedSet.size}
        initial={initial}
        onOpenSearch={() => router.push(href("/search-v2?focus=1"))}
        onOpenProfile={() => router.push(href("/profile-sheet"))}
        catalog={{
          rows,
          groups: controller.groups,
          grouped: controller.grouped,
          category: sort === "cat",
          strip,
          chip,
          onChip: controller.setChip,
          indexLabel: MOCKUP_DATA ? undefined : allCollectionsLabel(collectionCount),
          onOpenIndex: MOCKUP_DATA ? undefined : () => router.push(href("/songs-v2-index")),
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
        body={
          segment === "collections" ? (
            <CollectionsSegment
              theme={theme}
              stories={stories}
              storiesLoading={storiesLoading}
              onPlayAll={actions.playAll}
              onOpenFestival={(label) => openCollection(label, label)}
              onOpenStory={(story) => {
                setOpenStory(story)
                setStorySheetOpen(true)
              }}
              onOpenTile={openCollection}
            />
          ) : (
            <MineSegment
              theme={theme}
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
              onQuickStart={() => router.push(href("/drive"))}
              onOpenDownloads={() => router.push(href("/storage"))}
            />
          )
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
      <StorySheet
        open={storySheetOpen}
        theme={theme}
        slug={openStory?.slug ?? null}
        preview={openStory ? { slug: openStory.slug, title: openStory.title, teaser: openStory.teaser, songNumbers: openStory.songNumbers } : null}
        onClose={() => setStorySheetOpen(false)}
        onOpenSong={(target) => {
          setStorySheetOpen(false)
          router.push(href(target))
        }}
      />
      <Toast message={actions.toast} theme={theme} />
    </View>
  )
}

/**
 * A layer of the source switch. Only opacity changes (a quick fade, none with reduced motion); the
 * hidden layers stay mounted so the Prabhat Samgiita list keeps its place when you come back.
 */
function SourceLayer({ active, children }: { active: boolean; children: ReactNode }) {
  const reduce = useReducedMotion()
  const opacity = useSharedValue(active ? 1 : 0)
  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, { duration: reduce ? 0 : 180 })
  }, [active, reduce, opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents={active ? "auto" : "none"} accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"}>
      {children}
    </Animated.View>
  )
}

/**
 * Songs tab. A switch on top picks the source: Prabhat Samgiita (the catalog, collections and Mine),
 * Kirtan (YouTube kirtans people shared) or Mixes (songs and kirtans in one order). The choice is kept
 * in memory for the session. `?source=kirtan|mixes` opens a source directly.
 * Reachable at /songs-v2 and, as the Songs tab, at /v2/songs.
 */
export default function SongsV2Screen() {
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ source?: string }>()
  const source = useKirtanPlayerStore((s) => s.source)
  const setSource = useKirtanPlayerStore((s) => s.setSource)
  const top = Platform.OS === "web" ? 54 : insets.top
  const [seen, setSeen] = useState<Record<SourceId, boolean>>({ ps: true, kirtan: false, mixes: false })

  useEffect(() => {
    if (params.source === "kirtan" || params.source === "mixes" || params.source === "ps") setSource(params.source)
  }, [params.source, setSource])
  useEffect(() => {
    setSeen((cur) => (cur[source] ? cur : { ...cur, [source]: true }))
  }, [source])

  const content = top + SOURCE_BAR_BLOCK
  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <SourceLayer active={source === "ps"}>
        <PsSongs topExtra={SOURCE_BAR_BLOCK} />
      </SourceLayer>
      {seen.kirtan ? (
        <SourceLayer active={source === "kirtan"}>
          <KirtanSegment inset={content} avatarTop={content + 6} />
        </SourceLayer>
      ) : null}
      {seen.mixes ? (
        <SourceLayer active={source === "mixes"}>
          <MixesSegment inset={content} avatarTop={content + 6} />
        </SourceLayer>
      ) : null}
      {/* the switch sits on the page colour, above whatever scrolls under it */}
      <View pointerEvents="box-none" style={[styles.sourceBand, { height: top + SOURCE_BAR_HEIGHT + 4, paddingTop: top, backgroundColor: theme.page }]}>
        <SourceSwitch theme={theme} value={source} onChange={setSource} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sourceBand: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 30 },
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
