import { useEffect, useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

export default function AddToPlaylistScreen() {
  const router = useRouter()
  const { song } = useLocalSearchParams<{ song?: string }>()
  const songNumber = Number(song)
  const mode = useAuthStore((s) => s.mode)
  const playlists = usePlaylistStore((s) => s.playlists)
  const refresh = usePlaylistStore((s) => s.refresh)
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist)
  const addSong = usePlaylistStore((s) => s.addSong)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {playlists.map((playlist) => (
          <Pressable
            key={playlist.id}
            accessibilityRole="button"
            style={styles.row}
            onPress={() => {
              void addSong(playlist.id, songNumber).then((result) => {
                if (!isPlaylist(result)) {
                  Alert.alert("Playlist", "error" in result ? result.error : "Playlist creation requires you to sign in.")
                  return
                }
                Alert.alert("Playlist", `Added to ${result.name}.`)
                router.back()
              })
            }}
          >
            <Text style={styles.name}>{playlist.name}</Text>
            <Text style={styles.meta}>{playlist.songs.length} songs</Text>
          </Pressable>
        ))}
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
              setBusy(false)
              if (!isPlaylist(added)) {
                Alert.alert("Playlist", "error" in added ? added.error : "Could not add the song.")
                return
              }
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
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { ...typography.label, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textMuted },
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
