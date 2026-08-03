import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { ScenicPlayButton } from "@/components/player/ScenicPlayButton"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { songPlayback } from "@/lib/playback"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

export function MiniPlayer() {
  const router = useRouter()
  const currentSong = usePlayerStore((s) => s.currentSong)
  const showPause = usePlayerStore((s) =>
    s.currentSong ? songPlayback(s, s.currentSong).showPause : false,
  )
  const isBuffering = usePlayerStore((s) =>
    s.currentSong ? songPlayback(s, s.currentSong).isBuffering : false,
  )
  const audioError = usePlayerStore((s) => s.audioError)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const pause = usePlayerStore((s) => s.pause)

  if (!currentSong) return null

  return (
    <View style={styles.wrap}>
      <View>
        <ScenicPlayButton
          imageUrl={currentSong.thumbnailUrl}
          size="sm"
          isPlaying={showPause}
          onPress={() => {
            if (showPause) pause()
            else togglePlay()
          }}
          accessibilityLabel={showPause ? `Pause ${currentSong.title}` : `Play ${currentSong.title}`}
        />
        {isBuffering ? (
          <View style={styles.bufferOverlay} pointerEvents="none">
            <ActivityIndicator color={colors.white} size="small" />
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${currentSong.title}`}
        onPress={() => router.push(href(`/song/${currentSong.id}`))}
        style={({ pressed }) => [styles.meta, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.title} numberOfLines={1}>
          PS {currentSong.number} · {currentSong.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {audioError
            ? audioError
            : isBuffering
              ? "Loading audio…"
              : currentSong.themes.slice(0, 2).join(" · ")}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    height: 64,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
    ...softShadow(2),
  },
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,14,10,0.35)",
    borderRadius: radius.lg,
  },
  meta: {
    flex: 1,
    paddingRight: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  title: {
    ...typography.label,
    color: colors.textPrimary,
  },
  sub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
})
