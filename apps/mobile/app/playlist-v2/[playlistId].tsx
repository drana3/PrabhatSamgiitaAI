import { useEffect, useMemo, useState } from "react"
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Play } from "lucide-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PillButton } from "@/components/songs-v2/Pill"
import { PlaylistSongRow } from "@/components/songs-v2/PlaylistSongRow"
import { Press } from "@/components/songs-v2/Press"
import { EmptyNote, overStyle } from "@/components/songs-v2/primitives"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { BackHeader } from "@/components/songs-v2/StorageParts"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useFlushPlaylistsOnBlur } from "@/hooks/useFlushPlaylistsOnBlur"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSongTitles } from "@/hooks/useSongTitles"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { mineSyncStatus, playlistMeta, songEyebrow } from "@/lib/mineView"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { playPlaylist } from "@/lib/playPlaylist"
import { routeString } from "@/lib/songMap"
import { displayTitle } from "@/lib/songsV2/entry"
import { useAuthStore } from "@/stores/authStore"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { href } from "@/utils/href"

/**
 * One playlist. The prototype has no page for it (a playlist row in Mine just plays), so this page
 * borrows the prototype pieces: round back button, `.over` meta, 45px page heading, `.pill`
 * buttons and `.card.song` rows. Name, Play, Rename, Remove and Delete (behind a confirmation)
 * are the working logic of the first build. Reorder is not offered: the API has no reorder call.
 */
export default function PlaylistV2Screen() {
  useFlushPlaylistsOnBlur()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const inset = Platform.OS === "web" ? 54 : insets.top
  const openedAt = useRevealClock()
  const params = useLocalSearchParams<{ playlistId?: string | string[] }>()
  const playlistId = routeString(params.playlistId)

  const mode = useAuthStore((s) => s.mode)
  const playlist = usePlaylistStore((s) => s.playlists.find((item) => item.id === playlistId))
  const syncing = usePlaylistStore((s) => s.syncing)
  const syncError = usePlaylistStore((s) => s.error)
  const refresh = usePlaylistStore((s) => s.refresh)
  const renamePlaylist = usePlaylistStore((s) => s.renamePlaylist)
  const deletePlaylist = usePlaylistStore((s) => s.deletePlaylist)
  const removeSong = usePlaylistStore((s) => s.removeSong)
  const flushSync = usePlaylistStore((s) => s.flushSync)
  const offlineFiles = useOfflineAudioStore((s) => s.files)

  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(playlist?.name ?? "")

  useEffect(() => {
    if (!playlist) void refresh()
  }, [playlist, refresh])

  useEffect(() => {
    if (playlist?.name && !renaming) setName(playlist.name)
  }, [playlist?.name, renaming])

  const numbers = useMemo(
    () =>
      [...(playlist?.songs ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((song) => song.song_number),
    [playlist?.songs],
  )
  const titles = useSongTitles(numbers)
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

  const commitRename = async () => {
    const trimmed = name.trim()
    setRenaming(false)
    if (!playlistId || !trimmed || trimmed === playlist?.name) {
      setName(playlist?.name ?? "")
      return
    }
    const result = await renamePlaylist(playlistId, trimmed)
    if (!isPlaylist(result)) {
      Alert.alert("Playlist", "error" in result ? result.error : "Sign in to rename a playlist.")
    }
  }

  const confirmDelete = () => {
    if (!playlistId) return
    Alert.alert("Delete playlist", "This removes the playlist from your account. The songs stay in the catalog.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deletePlaylist(playlistId).then(() => router.back())
        },
      },
    ])
  }

  const play = () => {
    if (!playlist) return
    void playPlaylist(playlist).then((error) => {
      if (error) Alert.alert("Playlist", error)
    })
  }

  let block = 1
  const next = () => block++

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={[styles.root, { backgroundColor: theme.page, paddingTop: inset }]}>
        <SongsReveal index={0}>
          <BackHeader theme={theme} onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        </SongsReveal>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.body}
        >
          {!playlist ? (
            <SongsReveal index={next()}>
              <EmptyNote theme={theme}>Looking for this playlist…</EmptyNote>
            </SongsReveal>
          ) : (
            <>
              <SongsReveal index={next()} style={styles.head}>
                <Text style={[overStyle, { color: theme.accent }]}>{playlistMeta(numbers.length)}</Text>
                {renaming ? (
                  <TextInput
                    autoFocus
                    value={name}
                    onChangeText={setName}
                    onSubmitEditing={() => void commitRename()}
                    onBlur={() => void commitRename()}
                    returnKeyType="done"
                    accessibilityLabel="Playlist name"
                    style={[styles.nameInput, { backgroundColor: theme.card, borderColor: theme.line, color: theme.textHeading }]}
                  />
                ) : (
                  <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
                    {playlist.name}
                  </Text>
                )}
              </SongsReveal>

              <SongsReveal index={next()}>
                <View style={styles.actions}>
                  <PillButton
                    theme={theme}
                    fill
                    label="Play"
                    onPress={play}
                    disabled={numbers.length === 0}
                    icon={<Play size={18} color={amColors.white} fill={amColors.white} />}
                  />
                  <PillButton
                    theme={theme}
                    fill
                    tone="sand"
                    label={renaming ? "Save name" : "Rename"}
                    onPress={() => (renaming ? void commitRename() : setRenaming(true))}
                  />
                </View>
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
                      <PillButton theme={theme} tone="sand" label="Try again" onPress={() => void flushSync()} style={styles.start} />
                    ) : null}
                  </View>
                ) : null}
              </SongsReveal>

              <SongsReveal index={next()} style={styles.list}>
                {numbers.length === 0 ? (
                  <EmptyNote theme={theme}>
                    Nothing here yet. Open a song and choose Add to playlist, or press and hold a song in the catalog.
                  </EmptyNote>
                ) : (
                  numbers.map((number: number) => {
                    const title = displayTitle(titles.get(number) ?? `Prabhat Samgiita ${number}`)
                    return (
                      <PlaylistSongRow
                        key={number}
                        theme={theme}
                        eyebrow={songEyebrow(number, offlineNumbers.has(number))}
                        title={title}
                        accessibilityLabel={`PS ${number}, ${title}`}
                        removeLabel={`Remove PS ${number} from this playlist`}
                        onOpen={() => router.push(href(`/song/ps-${number}`))}
                        onRemove={() => {
                          if (playlistId) void removeSong(playlistId, number)
                        }}
                      />
                    )
                  })
                )}
              </SongsReveal>

              <SongsReveal index={next()} style={[styles.danger, { borderTopColor: theme.line }]}>
                <Press
                  accessibilityRole="button"
                  accessibilityLabel="Delete playlist"
                  onPress={confirmDelete}
                  pressedScale={0.98}
                  style={styles.deleteHit}
                >
                  <Text style={styles.deleteText}>Delete playlist</Text>
                </Press>
              </SongsReveal>
            </>
          )}
        </ScrollView>
      </View>
    </RevealClock.Provider>
  )
}

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
  nameInput: {
    height: 56,
    borderRadius: 70,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontFamily: amFonts.semi,
    fontSize: 19,
  },
  actions: { flexDirection: "row", gap: 8 },
  sync: { marginTop: 12, gap: 10, paddingHorizontal: 10 },
  syncText: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  start: { alignSelf: "flex-start" },
  list: { gap: 10 },
  danger: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 8, marginHorizontal: 10 },
  deleteHit: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  deleteText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20, color: amColors.danger },
})
