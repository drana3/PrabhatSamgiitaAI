import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { FilterSheet, RowMenuSheet, SortSheet } from "@/components/songs-v2/CatalogSheets"
import { CatalogSegment } from "@/components/songs-v2/CatalogSegment"
import { CollectionsSegment } from "@/components/songs-v2/CollectionsSegment"
import { MineSegment, type MinePlaylist } from "@/components/songs-v2/MineSegment"
import { Press } from "@/components/songs-v2/Press"
import { Segmented } from "@/components/songs-v2/Segmented"
import { StorySheet } from "@/components/songs-v2/StorySheet"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { TodaySearchPill } from "@/components/today/TodayBlocks"
import { amGap, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import { mapApiStory, type StorySummary } from "@/data/stories"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useCatalogController } from "@/hooks/useCatalogController"
import { useSongsV2Actions } from "@/hooks/useSongsV2Actions"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { api } from "@/lib/client"
import { memberProfileName } from "@/lib/displayName"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { playPlaylist } from "@/lib/playPlaylist"
import { EMPTY_FILTERS } from "@/lib/songsV2/filters"
import { buildSavedRows } from "@/lib/songsV2/mine"
import { parseSegment, type SongSegmentId } from "@/lib/songsV2/segments"
import { useAuthStore } from "@/stores/authStore"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

/**
 * Songs (spec SCR-11, SCR-17): `Catalog | Collections | Mine`.
 * Redesign screen, reachable at /songs-v2 until the tab bar switches to it.
 * The current Songs tab stays untouched.
 */
export default function SongsV2Screen() {
  const router = useRouter()
  const theme = useAmTheme()
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
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))

  const [stories, setStories] = useState<StorySummary[]>([])
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [openStory, setOpenStory] = useState<StorySummary | null>(null)
  const [storySheetOpen, setStorySheetOpen] = useState(false)

  useEffect(() => {
    if (params.segment) setSegment(parseSegment(params.segment))
  }, [params.segment])

  useEffect(() => {
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

  const initials =
    memberProfileName({ mode, email, displayName, displayNameOverridden }).trim().charAt(0).toUpperCase() || "·"

  const savedNumbers = useMemo(() => {
    const numbers = savedSongIds.flatMap((id) => {
      const match = /^ps-(\d+)$/i.exec(id)
      return match ? [Number(match[1])] : []
    })
    return numbers
  }, [savedSongIds])
  const savedSet = useMemo(() => new Set(savedNumbers), [savedNumbers])
  const offlineNumbers = useMemo(() => new Set(Object.values(offlineFiles).map((f) => f.songNumber)), [offlineFiles])
  const savedRows = useMemo(
    () => buildSavedRows({ savedNumbers, entries: catalog.byNumber, offlineNumbers }),
    [savedNumbers, catalog.byNumber, offlineNumbers],
  )
  const minePlaylists = useMemo<MinePlaylist[]>(
    () => playlists.map((p) => ({ id: p.id, name: p.name, songCount: p.songs.length })),
    [playlists],
  )

  const bottomPadding = hasSong ? 160 : 110

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

  const playListById = (id: string) => {
    const playlist = playlists.find((p) => p.id === id)
    if (playlist) void playPlaylist(playlist)
  }

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <View style={styles.header}>
        <Reveal index={0} style={styles.titleRow}>
          <Text style={[amType.display, { color: theme.textHeading }]} accessibilityRole="header">
            Songs
          </Text>
          <Press
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.push(href("/(tabs)/profile"))}
            pressedScale={0.94}
            style={[styles.avatar, { backgroundColor: theme.card, borderColor: theme.line }]}
          >
            <Text style={[amType.label, { color: theme.textHeading, letterSpacing: 0 }]}>{initials}</Text>
          </Press>
        </Reveal>
        <Reveal index={1}>
          <TodaySearchPill theme={theme} onPress={() => router.push(href("/search?focus=1"))} />
        </Reveal>
        <Reveal index={2}>
          <Segmented theme={theme} value={segment} onChange={setSegment} />
        </Reveal>
      </View>

      {segment === "catalog" ? (
        <CatalogSegment
          theme={theme}
          controller={controller}
          entries={catalog.entries}
          loading={catalog.loading}
          error={catalog.error}
          onReload={() => void catalog.reload()}
          savedNumbers={savedSet}
          offlineNumbers={offlineNumbers}
          bottomPadding={bottomPadding}
          onOpen={actions.open}
          onToggleSave={(entry) => void actions.toggleSave(entry)}
          onQueue={actions.queue}
          onPlayAll={actions.playAll}
          onOpenIndex={() => router.push(href("/songs-v2-index"))}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: amGap.block, paddingBottom: bottomPadding }}
        >
          {segment === "collections" ? (
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
              onOpen={actions.open}
              onToggleSave={(entry) => void actions.toggleSave(entry)}
              onQueue={actions.queue}
              onMenu={controller.setMenuEntry}
              onOpenPlaylist={(id) => router.push(href(`/playlist/${id}`))}
              onPlayPlaylist={playListById}
              onCreatePlaylist={createNewPlaylist}
              onQuickStart={() => router.push(href("/drive"))}
            />
          )}
        </ScrollView>
      )}

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
        onToggleSave={(entry) => void actions.toggleSave(entry)}
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
      <Toast message={actions.toast} bottom={bottomPadding - amSpace.s4} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: amGap.gutter, gap: amGap.grid, paddingBottom: amSpace.s3 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 56 },
  avatar: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amTouchTarget / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
