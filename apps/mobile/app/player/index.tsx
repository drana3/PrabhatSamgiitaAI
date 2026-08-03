import { Redirect, useRouter } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

/**
 * Legacy full-screen player — always send users to the song page,
 * which is the single play surface (autoplay + listen controls).
 */
export default function FullPlayerScreen() {
  const router = useRouter()
  const song = usePlayerStore((s) => s.currentSong)

  if (song) {
    return <Redirect href={href(`/song/${song.id}`)} />
  }

  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>Nothing playing</Text>
      <Pressable onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.link}>Close</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  emptyText: { ...typography.h3, color: colors.textPrimary },
  link: { ...typography.label, color: colors.primary },
})
