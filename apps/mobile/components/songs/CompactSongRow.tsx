import { Pressable, StyleSheet, Text, View } from "react-native"

import { ScenicPlayButton } from "@/components/player/ScenicPlayButton"
import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import type { MockSong } from "@/data/mock"
import { songPlayback } from "@/lib/playback"
import { songCardTitle } from "@/lib/songMap"
import { usePlayerStore } from "@/stores/playerStore"

type Props = {
  song: MockSong
  /** Opens the main song player. */
  onPress: () => void
  /** Optional queue when this row starts playback. */
  playQueue?: number[]
  /** Matching lyric line for search results. */
  lyricLine?: string
}

export function CompactSongRow({ song, onPress, lyricLine }: Props) {
  const showPause = usePlayerStore((s) => songPlayback(s, song).showPause)
  const isBuffering = usePlayerStore((s) => songPlayback(s, song).isBuffering)
  const pause = usePlayerStore((s) => s.pause)
  const title = songCardTitle(song)
  const lyrics = (lyricLine || song.originalTitle || song.lyrics || song.shortDescription || "").trim()
  const showLyrics = Boolean(lyrics) && lyrics.toLowerCase() !== title.toLowerCase()
  const lyricSearchRow = Boolean(lyricLine?.trim())

  return (
    <View style={styles.row}>
      <ScenicPlayButton
        imageUrl={song.thumbnailUrl}
        size="sm"
        isPlaying={showPause}
        onPress={() => {
          if (showPause) {
            pause()
            return
          }
          onPress()
        }}
        accessibilityLabel={showPause ? `Pause ${song.title}` : `Open and play ${song.title}`}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open PS ${song.number} ${song.title}`}
        onPress={onPress}
        style={({ pressed }) => [styles.meta, pressed && styles.pressed]}
      >
        <Text style={styles.number}>PS {song.number}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {showLyrics ? (
          <Text style={styles.lyrics} numberOfLines={3}>
            {lyrics}
          </Text>
        ) : lyricSearchRow ? null : (
          <Text style={styles.themes} numberOfLines={1}>
            {song.themes.join(" · ")}
            {isBuffering ? " · Loading…" : ""}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  meta: {
    flex: 1,
    minHeight: 52,
    justifyContent: "center",
  },
  number: {
    ...typography.caption,
    color: colors.textMuted,
  },
  title: {
    ...typography.label,
    fontSize: 15,
    color: colors.textPrimary,
  },
  lyrics: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  themes: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
})
