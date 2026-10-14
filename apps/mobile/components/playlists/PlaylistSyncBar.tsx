import { StyleSheet, Text, View } from "react-native"

import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { usePlaylistStore } from "@/stores/playlistStore"

/** Shown only when the user has nothing to look at yet, or when background sync failed. */
export function PlaylistSyncBar() {
  const loading = usePlaylistStore((s) => s.loading)
  const playlists = usePlaylistStore((s) => s.playlists)
  const error = usePlaylistStore((s) => s.error)

  const showInitialLoad = loading && playlists.length === 0
  if (!showInitialLoad && !error) return null

  if (error) {
    return (
      <View style={styles.wrap} accessibilityRole="alert">
        <Text style={styles.error}>{error}</Text>
      </View>
    )
  }

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel="Loading playlists">
      <Text style={styles.label}>Loading playlists…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
})
