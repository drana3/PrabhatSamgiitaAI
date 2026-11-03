import { useEffect, useMemo, useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Play, X } from "lucide-react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { SongCardRow } from "@/components/saved-v2/SongCardRow"
import { BackButton, Note, PillButton } from "@/components/saved-v2/ui"
import { PressScale, Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amGap, amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFontSize, amFonts, amType } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useFlushPlaylistsOnBlur } from "@/hooks/useFlushPlaylistsOnBlur"
import { useSongTitles } from "@/hooks/useSongTitles"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { mineSyncStatus, playlistMeta, songEyebrow } from "@/lib/mineView"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { playPlaylist } from "@/lib/playPlaylist"
import { routeString } from "@/lib/songMap"
import { useAuthStore } from "@/stores/authStore"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { href } from "@/utils/href"

/**
 * One playlist (redesign of app/playlist/[playlistId]): name, `9 songs · made by you`,
 * Play, Rename, the song rows with Remove, and Delete behind a confirmation.
 * Reorder is not offered: the playlist API has no reorder call yet.
 */
export default function PlaylistV2Screen() {
  useFlushPlaylistsOnBlur()
  const router = useRouter()
  const theme = useAmTheme()
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

  let block = 0
  const next = () => block++

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingHorizontal: amGap.gutter }]}
      >
        <Reveal index={next()}>
          <View style={styles.topBar}>
            <BackButton theme={theme} onPress={() => router.back()} />
          </View>
        </Reveal>

        {!playlist ? (
          <Reveal index={next()}>
            <Note theme={theme}>Looking for this playlist…</Note>
          </Reveal>
        ) : (
          <>
            <Reveal index={next()}>
              <Text style={[amType.label, { color: theme.eyebrow }]}>{playlistMeta(numbers.length)}</Text>
              {renaming ? (
                <TextInput
                  autoFocus
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={() => void commitRename()}
                  onBlur={() => void commitRename()}
                  returnKeyType="done"
                  accessibilityLabel="Playlist name"
                  style={[
                    styles.nameInput,
                    { backgroundColor: theme.card, borderColor: theme.line, color: theme.textHeading },
                  ]}
                />
              ) : (
                <Text style={[amType.title, styles.title, { color: theme.textHeading }]} accessibilityRole="header">
                  {playlist.name}
                </Text>
              )}
            </Reveal>

            <Reveal index={next()}>
              <View style={styles.actions}>
                <View style={styles.grow}>
                  <PillButton
                    theme={theme}
                    label="Play"
                    onPress={play}
                    disabled={numbers.length === 0}
                    icon={<Play size={18} color={theme.onBrand} fill={theme.onBrand} />}
                  />
                </View>
                <View style={styles.grow}>
                  <PillButton
                    theme={theme}
                    tone="sand"
                    label={renaming ? "Save name" : "Rename"}
                    onPress={() => (renaming ? void commitRename() : setRenaming(true))}
                  />
                </View>
              </View>
              {sync.kind !== "hidden" ? (
                <View style={styles.sync}>
                  <Text
                    style={[amType.body, { color: sync.kind === "error" ? theme.textHeading : theme.textBody, fontFamily: sync.kind === "error" ? amFonts.semi : amFonts.regular }]}
                    accessibilityRole={sync.kind === "error" ? "alert" : undefined}
                  >
                    {sync.text}
                  </Text>
                  {sync.kind === "error" ? (
                    <PillButton theme={theme} tone="sand" label="Try again" onPress={() => void flushSync()} />
                  ) : null}
                </View>
              ) : null}
            </Reveal>

            <Reveal index={next()}>
              {numbers.length === 0 ? (
                <Note theme={theme}>
                  Nothing here yet. Open a song and choose Add to playlist, or press and hold a song in the catalog.
                </Note>
              ) : (
                <View style={styles.stack}>
                  {numbers.map((number: number) => {
                    const title = titles.get(number) ?? `Prabhat Samgiita ${number}`
                    return (
                      <SongCardRow
                        key={number}
                        theme={theme}
                        eyebrow={songEyebrow(number, offlineNumbers.has(number))}
                        title={title}
                        accessibilityLabel={`PS ${number}, ${title}`}
                        onOpen={() => router.push(href(`/song/ps-${number}`))}
                        trailing={
                          <PressScale
                            accessibilityRole="button"
                            accessibilityLabel={`Remove PS ${number} from this playlist`}
                            onPress={() => {
                              if (playlistId) void removeSong(playlistId, number)
                            }}
                            pressedScale={0.88}
                            style={styles.remove}
                          >
                            <X size={20} color={theme.textBody} />
                          </PressScale>
                        }
                      />
                    )
                  })}
                </View>
              )}
            </Reveal>

            <Reveal index={next()}>
              <View style={[styles.danger, { borderTopColor: theme.line }]}>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Delete playlist"
                  onPress={confirmDelete}
                  style={styles.deleteHit}
                >
                  <Text style={[styles.deleteText, { color: amColors.danger }]}>Delete playlist</Text>
                </PressScale>
              </View>
            </Reveal>
          </>
        )}
        <View style={styles.tail} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { gap: amGap.block },
  topBar: { height: 56, justifyContent: "center", alignItems: "flex-start" },
  title: { marginTop: 6 },
  nameInput: {
    marginTop: 6,
    height: 56,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontFamily: amFonts.semi,
    fontSize: 19,
  },
  actions: { flexDirection: "row", gap: 10 },
  grow: { flex: 1 },
  sync: { marginTop: amGap.text, gap: 10 },
  stack: { gap: amGap.grid },
  remove: {
    width: amTouchTarget,
    height: amTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  danger: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: amGap.block, marginTop: amGap.block },
  deleteHit: { minHeight: amTouchTarget, justifyContent: "center", alignSelf: "flex-start" },
  deleteText: { fontFamily: amFonts.bold, fontSize: amFontSize.lead },
  tail: { height: 140 },
})
