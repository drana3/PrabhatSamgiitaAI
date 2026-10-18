import { useEffect, useState } from "react"
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { AddToPlaylistList } from "@/components/playlists/AddToPlaylistList"
import { PlaylistPlaybackBar } from "@/components/playlists/PlaylistPlaybackBar"
import { PlaylistSyncBar } from "@/components/playlists/PlaylistSyncBar"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { useFlushPlaylistsOnBlur } from "@/hooks/useFlushPlaylistsOnBlur"
import { href } from "@/utils/href"

export default function AddToPlaylistScreen() {
  useFlushPlaylistsOnBlur()
  const router = useRouter()
  const { song } = useLocalSearchParams<{ song?: string }>()
  const songNumber = Number(song)
  const mode = useAuthStore((s) => s.mode)
  const playlists = usePlaylistStore((s) => s.playlists)
  const refresh = usePlaylistStore((s) => s.refresh)
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist)
  const addSong = usePlaylistStore((s) => s.addSong)
  const flushSync = usePlaylistStore((s) => s.flushSync)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const activePlaylist = usePlayerStore((s) => s.activePlaylist)
  const showPlaybackBar = Boolean(activePlaylist?.id && playbackMode === "playlist")

  const handleAdd = (playlistId: string) => {
    setAddingId(playlistId)
    void addSong(playlistId, songNumber).then((result) => {
      setAddingId(null)
      if (!isPlaylist(result)) {
        Alert.alert(
          "Playlist",
          "error" in result ? result.error : "Playlist creation requires you to sign in.",
        )
        return
      }
      void flushSync().finally(() => router.back())
    })
  }

  useEffect(() => {
    if (mode === "signed_in") void refresh()
  }, [mode, refresh])

  if (mode !== "signed_in" || !Number.isFinite(songNumber)) {
    return (
      <ScreenContainer edges={["top"]} title="Add to playlist">
        <Text style={styles.copy}>Playlist creation requires you to sign in.</Text>
        <PrimaryButton label="Sign in" onPress={() => router.push(href("/signin"))} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer edges={["top"]} title="Add to playlist" subtitle={`PS ${songNumber}`}>
      <PlaylistSyncBar />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {showPlaybackBar ? <PlaylistPlaybackBar /> : null}
        <AddToPlaylistList
          playlists={playlists}
          songNumber={songNumber}
          addingId={addingId}
          onAdd={handleAdd}
        />
        <Text style={styles.label}>New playlist</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Playlist name"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <PrimaryButton
          label="Create and add song"
          loading={busy}
          disabled={!name.trim()}
          onPress={() => {
            setBusy(true)
            void createPlaylist(name.trim()).then(async (created) => {
              if (!isPlaylist(created)) {
                setBusy(false)
                Alert.alert(
                  "Playlist",
                  "error" in created ? created.error : "Playlist creation requires you to sign in.",
                )
                return
              }
              const added = await addSong(created.id, songNumber)
              if (!isPlaylist(added)) {
                setBusy(false)
                Alert.alert("Playlist", "error" in added ? added.error : "Could not add the song.")
                return
              }
              await flushSync()
              setBusy(false)
              router.back()
            })
          }}
        />
        <View />
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: 80 },
  copy: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
})
