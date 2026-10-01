import { useEffect, useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Pause, Play } from "lucide-react-native"

import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import { playPlaylist } from "@/lib/playPlaylist"
import { randomSongNumber } from "@/lib/playbackQueue"
import { songDetailToMockSong } from "@/lib/songMap"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePlayerStore } from "@/stores/playerStore"
import { useAuthStore } from "@/stores/authStore"

export default function DriveScreen() {
  const mode = useAuthStore((s) => s.mode)
  const playlists = usePlaylistStore((s) => s.playlists)
  const refresh = usePlaylistStore((s) => s.refresh)
  const current = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const loadSong = usePlayerStore((s) => s.loadSong)
  const [pickingPlaylist, setPickingPlaylist] = useState(false)

  useEffect(() => {
    if (mode === "signed_in") void refresh()
  }, [mode, refresh])

  const startRandom = async () => {
    const number = randomSongNumber(0)
    const detail = await api.fetchSong(number)
    if (!detail) {
      Alert.alert("Drive Mode", "Could not start a song. Check your connection.")
      return
    }
    loadSong(songDetailToMockSong(detail), [number], "random")
  }

  const driving = playbackMode === "random" || playbackMode === "playlist"

  return (
    <ScreenContainer edges={["top"]} title="Drive Mode" subtitle="Hands-free listening">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play random Prabhat Samgiita"
          onPress={() => void startRandom()}
          style={styles.large}
        >
          <Text style={styles.largeTitle}>Random Prabhat Samgiita</Text>
          <Text style={styles.largeBody}>A new song starts when this one ends.</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play a playlist"
          onPress={() => setPickingPlaylist((value) => !value)}
          style={styles.large}
        >
          <Text style={styles.largeTitle}>Playlist</Text>
          <Text style={styles.largeBody}>Songs continue in order until the playlist ends.</Text>
        </Pressable>

        {pickingPlaylist
          ? playlists.map((playlist) => (
              <Pressable
                key={playlist.id}
                accessibilityRole="button"
                accessibilityLabel={`Play ${playlist.name}`}
                onPress={() => {
                  void playPlaylist(playlist).then((error) => {
                    if (error) Alert.alert("Drive Mode", error)
                  })
                }}
                style={styles.playlist}
              >
                <Text style={styles.playlistName}>{playlist.name}</Text>
                <Text style={styles.largeBody}>{playlist.songs.length} songs</Text>
              </Pressable>
            ))
          : null}
        {pickingPlaylist && !playlists.length ? (
          <Text style={styles.largeBody}>
            {mode === "signed_in"
              ? "Create a playlist from the Saved tab first."
              : "Playlist creation requires you to sign in."}
          </Text>
        ) : null}

        {driving && current ? (
          <View style={styles.now}>
            <Text style={styles.nowLabel}>{playbackMode === "random" ? "Random" : "Playlist"}</Text>
            <Text style={styles.nowTitle}>
              PS {current.number}
              {"\n"}
              {current.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? "Pause" : "Play"}
              onPress={togglePlay}
              style={styles.play}
            >
              {isPlaying ? (
                <Pause size={36} color={colors.white} fill={colors.white} />
              ) : (
                <Play size={36} color={colors.white} fill={colors.white} />
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: 140 },
  large: {
    minHeight: 112,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    justifyContent: "center",
  },
  largeTitle: { fontFamily: "Lora_700Bold", fontSize: 26, lineHeight: 32, color: colors.textPrimary },
  largeBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  playlist: {
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md,
    justifyContent: "center",
  },
  playlistName: { ...typography.h3, color: colors.textPrimary },
  now: { marginTop: spacing.md, alignItems: "center", gap: spacing.md },
  nowLabel: { ...typography.caption, color: colors.primaryDark, textTransform: "uppercase" },
  nowTitle: {
    fontFamily: "Lora_700Bold",
    fontSize: 28,
    lineHeight: 34,
    textAlign: "center",
    color: colors.textPrimary,
  },
  play: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
})
