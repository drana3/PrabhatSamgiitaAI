import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { Heart, Play } from "lucide-react-native"

import { EmptyState } from "@/components/common/EmptyState"
import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { PlaylistSyncBar } from "@/components/playlists/PlaylistSyncBar"
import { CompactSongRow } from "@/components/songs/CompactSongRow"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import type { MockSong } from "@/data/mock"
import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { parseSongNumber, songSummaryToMockSong } from "@/lib/songMap"
import { playPlaylist } from "@/lib/playPlaylist"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useFlushPlaylistsOnBlur } from "@/hooks/useFlushPlaylistsOnBlur"
import { href } from "@/utils/href"

export default function SavedScreen() {
  useFlushPlaylistsOnBlur()
  const router = useRouter()
  const mode = useAuthStore((s) => s.mode)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const syncingFavorites = usePreferencesStore((s) => s.syncingFavorites)
  const hydrateFavoritesFromServer = usePreferencesStore((s) => s.hydrateFavoritesFromServer)
  const playlists = usePlaylistStore((s) => s.playlists)
  const hydratePlaylistsFromCache = usePlaylistStore((s) => s.hydrateFromCache)
  const refreshPlaylists = usePlaylistStore((s) => s.refresh)
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist)
  const [playlistName, setPlaylistName] = useState("")
  const [namingPlaylist, setNamingPlaylist] = useState(false)
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const songs = useMemo<MockSong[]>(() => {
    const numbers = savedSongIds.flatMap((id) => {
      const number = parseSongNumber(id)
      return number ? [number] : []
    })
    const byNumber = new Map(
      catalogSongsByNumbers(numbers, numbers.length).map((hit) => [hit.number, hit]),
    )
    return numbers.map((number) => {
      const hit = byNumber.get(number)
      if (!hit) {
        return songSummaryToMockSong({
          number,
          title: `Prabhat Samgiita ${number}`,
          is_verified: false,
        })
      }
      return songSummaryToMockSong({
        number: hit.number,
        title: hit.firstLine || hit.title,
        first_line: hit.snippet || hit.firstLine || hit.title,
        is_verified: true,
      })
    })
  }, [savedSongIds])

  useFocusEffect(
    useCallback(() => {
      if (mode !== "signed_in") return
      void hydratePlaylistsFromCache()
      void hydrateFavoritesFromServer()
      void refreshPlaylists()
    }, [mode, hydrateFavoritesFromServer, hydratePlaylistsFromCache, refreshPlaylists]),
  )

  const startPlaylist = () => {
    if (mode !== "signed_in") {
      Alert.alert("Sign in", "Playlist creation requires you to sign in.", [
        { text: "Not now", style: "cancel" },
        { text: "Sign in", onPress: () => router.push(href("/signin")) },
      ])
      return
    }
    setNamingPlaylist(true)
  }

  return (
    <ScreenContainer padded={false} showGuru={false}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Saved</Text>
            <Text style={styles.subtitle}>
              {mode === "guest"
                ? "Tap ♥ on any song · stored on this device"
                : memberAuthAvailable()
                  ? "Tap ♥ on any song · synced with your account"
                  : "Tap ♥ on any song · this build cannot sync the website playlist yet"}
            </Text>
          </View>
          {syncingFavorites && savedSongIds.length === 0 ? (
            <ActivityIndicator color={colors.primary} />
          ) : null}
      </View>
        <PlaylistSyncBar />
        <Text style={styles.playlistHint}>Tap ▶ to play a playlist · tap the name to edit</Text>
        <Pressable accessibilityRole="button" onPress={startPlaylist} style={styles.playlistButton}>
          <Text style={styles.playlistButtonText}>New playlist</Text>
        </Pressable>
        {namingPlaylist ? (
          <View style={styles.playlistForm}>
            <TextInput
              value={playlistName}
              onChangeText={setPlaylistName}
              placeholder="Playlist name"
              placeholderTextColor={colors.textMuted}
              style={styles.playlistInput}
            />
            <PrimaryButton
              label="Create playlist"
              disabled={!playlistName.trim()}
              onPress={() => {
                const trimmed = playlistName.trim()
                if (!trimmed) return
                setNamingPlaylist(false)
                setPlaylistName("")
                void createPlaylist(trimmed).then((result) => {
                  if (!isPlaylist(result)) {
                    Alert.alert(
                      "Playlist",
                      "error" in result ? result.error : "Playlist creation requires you to sign in.",
                    )
                    return
                  }
                })
              }}
            />
          </View>
        ) : null}
        {playlists.map((playlist) => (
          <View key={playlist.id} style={styles.playlistRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Play ${playlist.name}`}
              disabled={!playlist.songs.length}
              onPress={() => {
                void playPlaylist(playlist).then((error) => {
                  if (error) Alert.alert("Playlist", error)
                })
              }}
              style={({ pressed }) => [styles.playlistPlay, pressed && styles.pressed, !playlist.songs.length && styles.playlistPlayDisabled]}
            >
              <Play size={18} color={playlist.songs.length ? colors.primaryDark : colors.textMuted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(href(`/playlist/${playlist.id}`))}
              style={styles.playlistMetaPress}
            >
              <Text style={styles.playlistName}>{playlist.name}</Text>
              <Text style={styles.playlistMeta}>
                {playlist.songs.length ? `${playlist.songs.length} songs` : "Empty · tap to add songs"}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      {songs.length === 0 ? (
        <EmptyState
          title="No saved songs yet"
          description="Open a song and tap the heart (♥) at the top. Your list appears here in the Saved tab."
          actionLabel={mode === "guest" ? "Login / Sign Up" : undefined}
          onAction={mode === "guest" ? () => router.push(href("/signin")) : undefined}
          illustration={
            <View style={styles.illustration}>
              <Heart size={36} color={colors.lotusPink} fill={colors.lotusPink} />
            </View>
          }
        />
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: hasSong ? 160 : 110 }]}
          renderItem={({ item }) => (
            <CompactSongRow
              song={item}
              onPress={() => router.push(href(`/song/${item.id}`))}
            />
          )}
          ListFooterComponent={
            mode === "guest" ? (
              <View style={styles.guestCta}>
                <Text style={styles.guestText}>
                  Create an account to sync your saved songs across devices.
                </Text>
                <PrimaryButton label="Login / Sign Up" onPress={() => router.push(href("/signin"))} />
              </View>
            ) : null
          }
        />
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  playlistHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  playlistButton: { marginTop: spacing.sm, alignSelf: "flex-start" },
  pressed: { opacity: 0.88 },
  playlistButtonText: { ...typography.label, color: colors.primaryDark },
  playlistForm: { marginTop: spacing.sm, gap: spacing.sm },
  playlistInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  playlistPlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playlistPlayDisabled: { opacity: 0.5 },
  playlistMetaPress: { flex: 1, paddingVertical: spacing.xs },
  playlistName: { ...typography.label, color: colors.textPrimary },
  playlistMeta: { ...typography.caption, color: colors.textMuted },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  guestCta: { gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.lg },
  guestText: { ...typography.bodySmall, color: colors.textSecondary },
  illustration: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
})
