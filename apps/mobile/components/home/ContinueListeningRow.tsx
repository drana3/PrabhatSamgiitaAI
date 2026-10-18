import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { ScenicPlayButton } from "@/components/player/ScenicPlayButton"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import type { MockSong } from "@/data/mock"
import { songPlayback } from "@/lib/playback"
import { songCardTitle } from "@/lib/songMap"
import { usePlayerStore } from "@/stores/playerStore"

type Props = {
  songs: MockSong[]
  onOpen: (song: MockSong) => void
}

export function ContinueListeningRow({ songs, onOpen }: Props) {
  const playOrToggle = usePlayerStore((s) => s.playOrToggle)
  const currentSong = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isBuffering = usePlayerStore((s) => s.isBuffering)

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {songs.map((song) => {
        const { showPause, isBuffering: songBuffering } = songPlayback(
          { currentSong, isPlaying, isBuffering },
          song,
        )
        return (
          <Pressable
            key={song.id}
            accessibilityRole="button"
            accessibilityLabel={`Continue ${song.title}`}
            onPress={() => onOpen(song)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
          >
            <ScenicPlayButton
              imageUrl={song.thumbnailUrl}
              size="md"
              isPlaying={showPause}
              onPress={() => playOrToggle(song)}
              accessibilityLabel={showPause ? `Pause ${song.title}` : `Play ${song.title}`}
            />
            <View style={styles.meta}>
              <Text style={styles.ps}>PS {song.number}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {songCardTitle(song)}
              </Text>
              <Text style={styles.themes} numberOfLines={1}>
                {songBuffering ? "Loading…" : song.themes.slice(0, 2).join(" · ")}
              </Text>
            </View>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  card: {
    width: 260,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  meta: {
    flex: 1,
  },
  ps: {
    ...typography.caption,
    color: colors.textMuted,
  },
  title: {
    ...typography.label,
    color: colors.textPrimary,
  },
  themes: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
})
