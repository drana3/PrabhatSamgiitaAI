import { useCallback, useMemo, useState } from "react"
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated"

import {
  AccentCover,
  ActionBar,
  ChipsRow,
  CollageCover,
  LIST_SIDE,
  ListHeader,
  SongListRow,
} from "@/components/songs-v2/ListParts"
import { HiddenLine } from "@/components/songs-v2/HiddenLine"
import { ListMenuSheet, ListSortSheet, SongMenuSheet } from "@/components/songs-v2/ListSheets"
import { SongCardRow } from "@/components/songs-v2/SongCardRow"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { SP_BAR_CONTENT, SpStickyBar } from "@/components/song-v2/SpStickyBar"
import { Toast } from "@/components/songs-v2/Toast"
import { amFonts } from "@/constants/tokens/amTypography"
import { useListDownload } from "@/hooks/useListDownload"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongsV2ListPage } from "@/hooks/useSongsV2ListPage"
import { useSpTheme } from "@/hooks/useSpTheme"
import type { BarMarks } from "@/lib/songPage/stickyBar"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { collageCoverIds } from "@/lib/songsV2/listPage"
import { listPageRowHeight, ROW_GEOMETRY, slotHeight } from "@/lib/songsV2/rowStyles"
import { useListViewStore } from "@/stores/listViewStore"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import { useT } from "@/lib/i18n"

/** Rows that take part in the one staggered reveal; later rows (scrolled into view) just appear. */
const REVEALED_ROWS = 8

/**
 * Playlist-style page shared by All songs and a collection (Spotify structure, our look):
 * back row, cover + title + meta, action row (download, sort, dots, shuffle, play), chips, rows.
 * `kind` only changes the cover: a photo collage for All songs, an accent gradient for a collection.
 */
export function SongsListPage({
  listId,
  title,
  kind,
  entries,
  loading = false,
  loadingText,
  emptyText,
}: {
  listId: string
  title: string
  kind: "all" | "collection"
  entries: readonly CatalogEntry[]
  loading?: boolean
  loadingText?: string
  emptyText?: string
}) {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const sp = useSpTheme()
  const insets = useSafeAreaInsets()
  // The phone-frame preview on the web draws the 54px status area of the board.
  const inset = Platform.OS === "web" ? 54 : insets.top
  const openedAt = useRevealClock()
  const bottomInset = useScrollBottomInset()
  const list = useSongsV2ListPage({ listId, listName: title, entries })
  const shownNumbers = useMemo(() => list.shown.map((e) => e.number), [list.shown])
  const listDownload = useListDownload(shownNumbers, title)
  // "Rows" setting: Tracklist and Compact rows, or Cards (this page's 64px picture row)
  const rowStyle = useListViewStore((s) => s.rowStyle)
  const rowHeight = listPageRowHeight(rowStyle)

  const [menuEntry, setMenuEntry] = useState<CatalogEntry | null>(null)
  const [sortOpen, setSortOpen] = useState(false)
  const [listMenuOpen, setListMenuOpen] = useState(false)

  const openMenu = useCallback((entry: CatalogEntry) => setMenuEntry(entry), [])
  const closeMenu = useCallback(() => setMenuEntry(null), [])

  const coverIds = useMemo(() => collageCoverIds(list.base.map((e) => e.number)), [list.base])
  const cover =
    kind === "all" ? <CollageCover ids={coverIds} tint={theme.inner} /> : <AccentCover label={title} dark={theme.dark} />
  const bottom = bottomInset

  // Collapsing top bar (SpStickyBar): back button always, title and a round play-all button fade in as the header leaves.
  const barHeight = inset + SP_BAR_CONTENT
  const scrollY = useSharedValue(0)
  const [headH, setHeadH] = useState(180)
  const marks = useSharedValue<BarMarks>({ barHeight, coverTop: barHeight, coverBottom: barHeight + 120, titleBottom: barHeight + 180, playTop: barHeight + 190, playBottom: barHeight + 250 })
  const onHeadLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const h = Math.round(event.nativeEvent.layout.height)
      setHeadH(h)
      marks.value = {
        barHeight,
        coverTop: barHeight,
        coverBottom: barHeight + h * 0.6,
        titleBottom: barHeight + h,
        playTop: barHeight + h + 8,
        playBottom: barHeight + h + 60,
      }
    },
    [barHeight, marks],
  )
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
  })
  const rowsLive = list.shown.length > 0

  const renderItem = useCallback(
    ({ item, index }: { item: CatalogEntry; index: number }) => {
      const row =
        rowStyle === "cards" ? (
          <SongListRow
            theme={theme}
            entry={item}
            current={list.currentNumber === item.number}
            saved={list.saved.has(item.number)}
            download={list.downloaded.has(item.number) ? "done" : list.downloading.has(item.number) ? "downloading" : "idle"}
            onPlay={list.playRow}
            onMenu={openMenu}
          />
        ) : (
          <View style={{ height: slotHeight(rowStyle, "song"), paddingLeft: ROW_GEOMETRY[rowStyle].padLeft, paddingRight: 10 }}>
            <SongCardRow
              theme={theme}
              entry={item}
              variant={rowStyle}
              saved={list.saved.has(item.number)}
              offline={list.downloaded.has(item.number)}
              onOpen={list.playRow}
              onToggleSave={list.toggleSave}
              onQueue={list.queueEntry}
              onMenu={openMenu}
            />
          </View>
        )
      return index < REVEALED_ROWS ? <SongsReveal index={4 + index}>{row}</SongsReveal> : row
    },
    [theme, rowStyle, list.currentNumber, list.saved, list.downloaded, list.downloading, list.playRow, list.toggleSave, list.queueEntry, openMenu],
  )

  const header = (
    <View>
      {/* the bar (drawn over the page) holds the back button; this is its room */}
      <View style={{ height: SP_BAR_CONTENT }} />
      <SongsReveal index={1}>
        <View onLayout={onHeadLayout}>
          <ListHeader theme={theme} title={title} meta={list.meta} cover={cover} />
        </View>
      </SongsReveal>
      <HiddenLine theme={theme} count={list.hiddenCount} onShow={list.showHidden} />
      <SongsReveal index={2}>
        <ActionBar
          theme={theme}
          download={listDownload.view}
          playing={list.playingHere}
          disabled={!rowsLive}
          onDownload={listDownload.press}
          onSort={() => setSortOpen(true)}
          onMenu={() => setListMenuOpen(true)}
          onShuffle={list.shuffle}
          onPlay={list.play}
        />
      </SongsReveal>
      <SongsReveal index={3}>
        <ChipsRow theme={theme} chips={list.chips} active={list.chip} onPick={list.setChip} />
      </SongsReveal>
    </View>
  )

  const emptyMessage = loading ? (loadingText ?? t("songs.list.loading")) : list.base.length === 0 ? (emptyText ?? t("songs.list.empty")) : list.empty

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page }]}>
        <Animated.FlatList
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListHeaderComponentStyle={{ paddingTop: inset }}
          data={list.shown}
          keyExtractor={(entry) => String(entry.number)}
          renderItem={renderItem}
          extraData={list}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textBody }]}>{emptyMessage}</Text>
          }
          getItemLayout={(_data, index) => ({ length: rowHeight, offset: rowHeight * index, index })}
          initialNumToRender={14}
          maxToRenderPerBatch={16}
          windowSize={9}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottom }}
        />
        <SpStickyBar
          t={sp}
          title={title}
          tint={theme.page}
          scrollY={scrollY}
          marks={marks}
          topInset={inset}
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          onAction={list.play}
          showAction={rowsLive}
          playing={list.playingHere}
          highlight={list.playingHere}
          actionLabel={list.playingHere ? t("songs.bar.pause") : t("today.playAll")}
        />

        <SongMenuSheet
          open={menuEntry != null}
          theme={theme}
          entry={menuEntry}
          listName={title}
          saved={menuEntry ? list.saved.has(menuEntry.number) : false}
          playlists={list.playlistRows(menuEntry)}
          onPlayNext={list.playNextEntry}
          onQueue={list.queueEntry}
          onToggleSave={list.toggleSave}
          onTogglePlaylist={list.togglePlaylist}
          onNewPlaylist={list.newPlaylist}
          onShare={list.share}
          onOpenSong={list.open}
          removal={list.removal}
          onRemove={list.removeRow}
          onClose={closeMenu}
        />
        <ListSortSheet
          open={sortOpen}
          theme={theme}
          value={list.sort}
          onPick={(key) => {
            list.setSort(key)
            setSortOpen(false)
          }}
          onClose={() => setSortOpen(false)}
        />
        <ListMenuSheet
          open={listMenuOpen}
          theme={theme}
          name={title}
          hiddenCount={list.hiddenCount}
          downloadedCount={list.downloadedCount}
          onQueueAll={list.queueAll}
          onRemoveDownloads={list.removeAllDownloads}
          onShowHidden={list.showHidden}
          onClose={() => setListMenuOpen(false)}
        />
        <Toast message={list.toast} action={list.toastAction} theme={theme} />
      </View>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: {
    fontFamily: amFonts.medium,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: LIST_SIDE,
    paddingTop: 24,
  },
})
