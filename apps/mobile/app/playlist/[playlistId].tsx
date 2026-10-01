import { useEffect, useMemo, useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { CompactSongRow } from "@/components/songs/CompactSongRow"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { playPlaylist } from "@/lib/playPlaylist"
import { songSummaryToMockSong } from "@/lib/songMap"
import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { href } from "@/utils/href"

export default function PlaylistDetailScreen() {
  const router = useRouter()
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>()
  const playlist = usePlaylistStore((s) => s.playlists.find((item) => item.id === playlistId))
  const refresh = usePlaylistStore((s) => s.refresh)
  const renamePlaylist = usePlaylistStore((s) => s.renamePlaylist)
  const deletePlaylist = usePlaylistStore((s) => s.deletePlaylist)
  const removeSong = usePlaylistStore((s) => s.removeSong)
  const [name, setName] = useState(playlist?.name ?? "")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!playlist) void refresh()
  }, [playlist, refresh])

  useEffect(() => {
    if (playlist?.name) setName(playlist.name)
  }, [playlist?.name])

  const songs = useMemo(() => {
    const numbers = [...(playlist?.songs ?? [])]
      .sort((left, right) => left.position - right.position)
      .map((song) => song.song_number)
    const byNumber = new Map(catalogSongsByNumbers(numbers, numbers.length).map((hit) => [hit.number, hit]))
    return numbers.map((number) => {
      const hit = byNumber.get(number)
      return songSummaryToMockSong({
        number,
        title: hit?.firstLine || hit?.title || `Prabhat Samgiita ${number}`,
        first_line: hit?.snippet || hit?.firstLine,
        is_verified: Boolean(hit),
      })
    })
  }, [playlist?.songs])

  const saveName = async () => {
    if (!playlistId || !name.trim()) return
    setBusy(true)
    const result = await renamePlaylist(playlistId, name.trim())
    setBusy(false)
    if (!isPlaylist(result)) {
      Alert.alert("Playlist", "error" in result ? result.error : "Playlist creation requires you to sign in.")
    }
  }

  return (
    <ScreenContainer edges={["top"]} title={playlist?.name || "Playlist"} subtitle="Signed-in playlist">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Playlist name"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          onEndEditing={() => void saveName()}
        />
        <PrimaryButton
          label="Play playlist"
          disabled={!songs.length || busy}
          onPress={() => {
            if (!playlist) return
            void playPlaylist(playlist).then((error) => {
              if (error) Alert.alert("Playlist", error)
            })
          }}
        />
        {songs.map((song) => (
          <View key={song.id} style={styles.row}>
            <CompactSongRow
              song={song}
              showShare
              onPress={() => router.push(href(`/song/${song.id}`))}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove PS ${song.number}`}
              onPress={() => {
                if (!playlistId) return
                void removeSong(playlistId, song.number)
              }}
            >
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {!songs.length ? <Text style={styles.empty}>Add songs from any song page.</Text> : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!playlistId) return
            Alert.alert("Delete playlist", "This removes the playlist from your account.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                  void deletePlaylist(playlistId).then(() => router.back())
                },
              },
            ])
          }}
        >
          <Text style={styles.delete}>Delete playlist</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120, gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    ...typography.body,
  },
  row: { gap: spacing.xs },
  remove: { ...typography.caption, color: colors.primaryDark, paddingLeft: spacing.sm },
  empty: { ...typography.body, color: colors.textSecondary },
  delete: { ...typography.label, color: "#8b3a3a", marginTop: spacing.lg },
})
