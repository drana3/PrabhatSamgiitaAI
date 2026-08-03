import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { Heart } from "lucide-react-native"

import { EmptyState } from "@/components/common/EmptyState"
import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { CompactSongRow } from "@/components/songs/CompactSongRow"
import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { parseSongNumber, songDetailToMockSong, songSummaryToMockSong } from "@/lib/songMap"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { href } from "@/utils/href"

export default function SavedScreen() {
  const router = useRouter()
  const mode = useAuthStore((s) => s.mode)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const syncingFavorites = usePreferencesStore((s) => s.syncingFavorites)
  const hydrateFavoritesFromServer = usePreferencesStore((s) => s.hydrateFavoritesFromServer)
  const hasSong = usePlayerStore((s) => Boolean(s.currentSong))
  const [songs, setSongs] = useState<MockSong[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode === "signed_in") {
      void hydrateFavoritesFromServer()
    }
  }, [mode, hydrateFavoritesFromServer])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!savedSongIds.length) {
        setSongs([])
        return
      }
      setLoading(true)
      const resolved: MockSong[] = []
      for (const id of savedSongIds) {
        const number = parseSongNumber(id)
        if (!number) continue
        const detail = await api.fetchSong(number)
        if (detail) resolved.push(songDetailToMockSong(detail))
        else
          resolved.push(
            songSummaryToMockSong({ number, title: `Prabhat Samgiita ${number}`, is_verified: false }),
          )
      }
      if (active) {
        setSongs(resolved)
        setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [savedSongIds])

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
                  : "Tap ♥ on any song · account sync needs member API key"}
            </Text>
          </View>
          {loading || syncingFavorites ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
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
