import { useEffect, useMemo, useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native"
import { Camera } from "lucide-react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { PlaylistCover } from "@/components/playlists/PlaylistCover"
import { PlayGlyph } from "@/components/songs-v2/Glyphs"
import { ListDownloadRow } from "@/components/offline/ListDownloadRow"
import { SongMenuSheet } from "@/components/songs-v2/ListSheets"
import { PillButton } from "@/components/songs-v2/Pill"
import { PlaylistSongRow } from "@/components/songs-v2/PlaylistSongRow"
import { Press } from "@/components/songs-v2/Press"
import { EmptyNote, overStyle } from "@/components/songs-v2/primitives"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { BackHeader } from "@/components/songs-v2/StorageParts"
import { Toast } from "@/components/songs-v2/Toast"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScreenTop } from "@/hooks/useScreenTop"
import { useFlushPlaylistsOnBlur } from "@/hooks/useFlushPlaylistsOnBlur"
import { useSongsV2Catalog } from "@/hooks/useSongsV2Catalog"
import { useSongsV2ListPage } from "@/hooks/useSongsV2ListPage"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongTitles } from "@/hooks/useSongTitles"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { stackGap } from "@/lib/songsV2/rowStyles"
import { useListViewStore } from "@/stores/listViewStore"
import { mineSyncStatus, playlistMeta, songEyebrow } from "@/lib/mineView"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { playPlaylist } from "@/lib/playPlaylist"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { routeString } from "@/lib/songMap"
import { MOCK_PLAYLISTS } from "@/lib/fixtures/songsMock"
import { previewTitle } from "@/lib/previewCatalog"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { displayTitle, placeholderEntry, type CatalogEntry } from "@/lib/songsV2/entry"
import { withFixtureStats } from "@/lib/fixtures/songs"
import { playlistListId } from "@/lib/songsV2/rowMenu"
import { useAuthStore } from "@/stores/authStore"
import { openPlaylistDelete, openPlaylistPhoto, openPlaylistRename } from "@/stores/playlistSheetsStore"
import { usePlaylistStore } from "@/stores/playlistStore"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"

/**
 * One playlist. The prototype has no page for it (a playlist row in Mine just plays), so this page
 * borrows the prototype pieces: round back button, `.over` meta, 45px page heading, `.pill`
 * buttons and `.card.song` rows. Name, Play, Rename, Remove and Delete (behind a confirmation)
 * are the working logic of the first build. The playlist has a photo (tap it to change it: a grid of 12 and "Shuffle another");
 * Rename and Delete open the shared playlist sheets (components/playlists/PlaylistSheetsHost.tsx).
 * Reorder is not offered: the API has no reorder call.
 */
export default function PlaylistV2Screen() {
  const bottomInset = useScrollBottomInset()
  const t = useT()
  useFlushPlaylistsOnBlur()
  const router = useRouter()
  const theme = useSongsTheme()
  const inset = useScreenTop()
  const openedAt = useRevealClock()
  const rowStyle = useListViewStore((s) => s.rowStyle)
  const params = useLocalSearchParams<{ playlistId?: string | string[] }>()
  const playlistId = routeString(params.playlistId)

  const mode = useAuthStore((s) => s.mode)
  const storePlaylist = usePlaylistStore((s) => s.playlists.find((item) => item.id === playlistId))
  // Preview (MOCKUP_DATA): the prototype's two playlists.
  const mockPlaylist = useMemo(() => {
    const found = MOCKUP_DATA ? MOCK_PLAYLISTS.find((p) => p.id === playlistId) : undefined
    return found
      ? ({ id: found.id, name: found.name, songs: found.songs.map((n, i) => ({ song_number: n, position: i })) } as unknown as typeof storePlaylist)
      : undefined
  }, [playlistId])
  const playlist = storePlaylist ?? mockPlaylist
  const syncing = usePlaylistStore((s) => s.syncing)
  const syncError = usePlaylistStore((s) => s.error)
  const refresh = usePlaylistStore((s) => s.refresh)
  const flushSync = usePlaylistStore((s) => s.flushSync)
  const offlineFiles = useOfflineAudioStore((s) => s.files)

  // "looked": the list was asked for and answered, so a missing playlist is "not found", not "still loading"
  const [looked, setLooked] = useState(false)
  const [lookAttempt, setLookAttempt] = useState(0)
  useEffect(() => {
    if (playlist || MOCKUP_DATA) return
    let alive = true
    void refresh()
      .catch(() => undefined)
      .finally(() => alive && setLooked(true))
    return () => {
      alive = false
    }
  }, [playlist, refresh, lookAttempt])

  const numbers = useMemo(
    () =>
      [...(playlist?.songs ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((song) => song.song_number),
    [playlist?.songs],
  )
  const realTitles = useSongTitles(numbers)
  const titles = useMemo(
    () => (MOCKUP_DATA ? new Map(numbers.flatMap((n) => { const t = previewTitle(n); return t ? [[n, t] as const] : [] })) : realTitles),
    [realTitles, numbers],
  )
  // The song menu of a row is the one of the catalogue lists; in an own playlist its last row really removes the song.
  const catalog = useSongsV2Catalog()
  const entries = useMemo<CatalogEntry[]>(
    () => numbers.map((n) => catalog.byNumber.get(n) ?? withFixtureStats(placeholderEntry(n))),
    [numbers, catalog.byNumber],
  )
  const list = useSongsV2ListPage({
    listId: playlistListId(playlistId ?? ""),
    listName: playlist?.name ?? "this playlist",
    entries,
  })
  const [menuEntry, setMenuEntry] = useState<CatalogEntry | null>(null)
  const offlineNumbers = useMemo(
    () => new Set(Object.values(offlineFiles).map((entry) => entry.songNumber)),
    [offlineFiles],
  )
  const sync = mineSyncStatus({
    mode,
    syncAvailable: memberAuthAvailable(),
    syncing,
    error: syncError,
  })

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(NAV_V2_HOME_ROUTE))
  }
  const confirmDelete = () => {
    if (playlistId) openPlaylistDelete(playlistId, goBack)
  }

  const play = () => {
    if (!playlist) return
    void playPlaylist(playlist).then((error) => {
      if (error) Alert.alert(t("player.playlist"), error)
    })
  }

  let block = 1
  const next = () => block++

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page, paddingTop: inset }]}>
        <SongsReveal index={0}>
          <BackHeader theme={theme} onBack={() => (router.canGoBack() ? router.back() : router.replace(href(NAV_V2_HOME_ROUTE)))} />
        </SongsReveal>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.body, { paddingBottom: bottomInset }]}
        >
          {!playlist ? (
            <SongsReveal index={next()}>
              {looked && !syncing ? (
                <View style={styles.sync}>
                  <EmptyNote theme={theme}>{t("playlist.missing")}</EmptyNote>
                  <PillButton
                    theme={theme}
                    tone="sand"
                    label={t("common.tryAgain")}
                    onPress={() => {
                      setLooked(false)
                      setLookAttempt((n) => n + 1)
                    }}
                    style={styles.start}
                  />
                </View>
              ) : (
                <EmptyNote theme={theme}>{t("playlist.loading")}</EmptyNote>
              )}
            </SongsReveal>
          ) : (
            <>
              <SongsReveal index={next()} style={styles.head}>
                <Press
                  accessibilityRole="button"
                  accessibilityLabel={t("pl.photo.change")}
                  onPress={() => playlistId && openPlaylistPhoto(playlistId)}
                  pressedScale={0.97}
                  outerStyle={styles.coverOuter}
                  style={styles.cover}
                >
                  <PlaylistCover id={playlist.id} size={COVER} radius={20} />
                  <View style={[styles.coverBadge, { backgroundColor: theme.ink900 }]} accessible={false}>
                    <Camera size={16} color={theme.onInk} />
                  </View>
                </Press>
                <Text style={[overStyle, { color: theme.accent }]}>{playlistMeta(numbers.length)}</Text>
                <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
                  {playlist.name}
                </Text>
              </SongsReveal>

              <SongsReveal index={next()}>
                <View style={styles.actions}>
                  <PillButton
                    theme={theme}
                    fill
                    label={t("player.play")}
                    onPress={play}
                    disabled={numbers.length === 0}
                    icon={<PlayGlyph color={amColors.white} />}
                  />
                  <PillButton
                    theme={theme}
                    fill
                    tone="sand"
                    label={t("playlist.rename")}
                    onPress={() => playlistId && openPlaylistRename(playlistId)}
                  />
                </View>
                <ListDownloadRow theme={theme} numbers={numbers} name={playlist.name} style={styles.download} />
                {sync.kind !== "hidden" ? (
                  <View style={styles.sync}>
                    <Text
                      style={[
                        styles.syncText,
                        { color: sync.kind === "error" ? theme.textHeading : theme.textBody },
                        sync.kind === "error" && { fontFamily: amFonts.semi },
                      ]}
                      accessibilityRole={sync.kind === "error" ? "alert" : undefined}
                    >
                      {sync.text}
                    </Text>
                    {sync.kind === "error" ? (
                      <PillButton theme={theme} tone="sand" label={t("common.tryAgain")} onPress={() => void flushSync()} style={styles.start} />
                    ) : null}
                  </View>
                ) : null}
              </SongsReveal>

              <SongsReveal index={next()} style={[styles.list, { gap: stackGap(rowStyle) }]}>
                {numbers.length === 0 ? (
                  <EmptyNote theme={theme}>
                    {t("playlist.empty")}
                  </EmptyNote>
                ) : (
                  numbers.map((number: number) => {
                    const title = displayTitle(titles.get(number) ?? `Prabhat Samgiita ${number}`)
                    return (
                      <PlaylistSongRow
                        key={number}
                        theme={theme}
                        number={number}
                        offline={offlineNumbers.has(number)}
                        eyebrow={songEyebrow(number, offlineNumbers.has(number))}
                        title={title}
                        accessibilityLabel={`PS ${number}, ${title}`}
                        menuLabel={t("playlist.moreActions", { number: String(number) })}
                        onOpen={() => router.push(href(`/song-v2/ps-${number}`))}
                        onMenu={() => setMenuEntry(entries.find((e) => e.number === number) ?? null)}
                      />
                    )
                  })
                )}
              </SongsReveal>

              <SongsReveal index={next()} style={[styles.danger, { borderTopColor: theme.line }]}>
                <Press
                  accessibilityRole="button"
                  accessibilityLabel={t("playlist.delete")}
                  onPress={confirmDelete}
                  pressedScale={0.98}
                  style={styles.deleteHit}
                >
                  <Text style={styles.deleteText}>{t("playlist.delete")}</Text>
                </Press>
              </SongsReveal>
            </>
          )}
        </ScrollView>

        <SongMenuSheet
          open={menuEntry != null}
          theme={theme}
          entry={menuEntry}
          listName={playlist?.name ?? "Playlist"}
          saved={menuEntry ? list.saved.has(menuEntry.number) : false}
          playlists={list.playlistRows(menuEntry)}
          removal={list.removal}
          onPlayNext={list.playNextEntry}
          onQueue={list.queueEntry}
          onToggleSave={list.toggleSave}
          onTogglePlaylist={list.togglePlaylist}
          onNewPlaylist={list.newPlaylist}
          onShare={list.share}
          onOpenSong={list.open}
          onRemove={list.removeRow}
          onClose={() => setMenuEntry(null)}
        />
        <Toast message={list.toast} action={list.toastAction} theme={theme} />
      </View>
    </RevealClock.Provider>
  )
}

/** side of the playlist photo at the top of the page */
const COVER = 132

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 10, paddingBottom: 140, gap: 20 },
  head: { gap: 8, paddingHorizontal: 10 },
  h1: {
    fontFamily: amFonts.display,
    fontSize: 45,
    lineHeight: 45,
    letterSpacing: -0.9,
    textTransform: "uppercase",
  },
  coverOuter: { alignSelf: "flex-start", marginBottom: 4 },
  cover: { width: COVER, height: COVER },
  coverBadge: { position: "absolute", right: 6, bottom: 6, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 8 },
  download: { marginTop: 12 },
  sync: { marginTop: 12, gap: 10, paddingHorizontal: 10 },
  syncText: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  start: { alignSelf: "flex-start" },
  list: { gap: 10 },
  danger: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 8, marginHorizontal: 10 },
  deleteHit: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  deleteText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20, color: amColors.danger },
})
