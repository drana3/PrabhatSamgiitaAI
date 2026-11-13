import { useMemo } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Pause, Play, Repeat, SkipBack, SkipForward } from "lucide-react-native"

import { ScenicBackgroundImage } from "@/components/common/ScenicBackgroundImage"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { amColors, amScrimPhoto, type AmTheme } from "@/constants/tokens/amColors"
import { useAmTheme } from "@/hooks/useAmTheme"
import type { MockSong } from "@/data/mock"
import { DriveSeekBar } from "@/components/drive/DriveSeekBar"
import type { PlaybackMode } from "@/lib/playbackQueue"
import { formatDuration } from "@/utils/formatDuration"

type Props = {
  song: MockSong
  mode: PlaybackMode
  isPlaying: boolean
  isBuffering?: boolean
  position: number
  duration: number
  onSeek: (seconds: number) => void
  onTogglePlay: () => void
  onPrevious: () => void
  onNext: () => void
  canGoPrevious?: boolean
  canGoNext?: boolean
  driveRepeat: boolean
  onToggleDriveRepeat: () => void
  playlistSubtitle?: string | null
}

export function DriveNowPlaying({
  song,
  mode,
  isPlaying,
  isBuffering,
  position,
  duration,
  onSeek,
  onTogglePlay,
  onPrevious,
  onNext,
  canGoPrevious = true,
  canGoNext = true,
  driveRepeat,
  onToggleDriveRepeat,
  playlistSubtitle,
}: Props) {
  const theme = useAmTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const modeLabel =
    mode === "random"
      ? "Random drive"
      : playlistSubtitle?.trim() || "Playlist drive"

  return (
    <View style={styles.cardOuter}>
      <View style={styles.card}>
      <ScenicBackgroundImage uri={song.imageUrl} style={StyleSheet.absoluteFill} priority="high" />
      <LinearGradient
        colors={["rgba(20,14,10,0.15)", "rgba(20,14,10,0.72)", "rgba(20,14,10,0.92)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.inner}>
        <View style={styles.captions}>
          <LinearGradient
            colors={[amScrimPhoto[1], amScrimPhoto[1], amScrimPhoto[0]]}
            locations={[0, 0.7, 1]}
            style={styles.captionsScrim}
            pointerEvents="none"
          />
          <Text style={styles.eyebrow}>{modeLabel}</Text>
          <Text style={styles.number}>PS {song.number}</Text>
          <Text style={styles.title} numberOfLines={2}>{song.title}</Text>
          {song.shortDescription ? (
            <Text style={styles.line} numberOfLines={1}>{song.shortDescription}</Text>
          ) : null}
        </View>

        <View style={styles.seekWrap}>
          <DriveSeekBar
            position={position}
            duration={duration}
            onSeek={onSeek}
            accessibilityLabel="Drag to seek in this song"
          />
          <View style={styles.timeRow}>
            <Text style={styles.time}>{formatDuration(position)}</Text>
            <Text style={styles.time}>{formatDuration(duration)}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous song"
            accessibilityState={{ disabled: !canGoPrevious }}
            disabled={!canGoPrevious}
            onPress={onPrevious}
            style={({ pressed }) => [
              styles.sideBtn,
              !canGoPrevious && styles.sideBtnDisabled,
              pressed && canGoPrevious && styles.pressed,
            ]}
          >
            <SkipBack size={28} color={canGoPrevious ? amColors.white : "rgba(255,255,255,0.35)"} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
            onPress={onTogglePlay}
            style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
          >
            {isPlaying ? (
              <Pause size={34} color={amColors.white} fill={amColors.white} />
            ) : (
              <Play size={34} color={amColors.white} fill={amColors.white} style={{ marginLeft: 4 }} />
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next song"
            accessibilityState={{ disabled: !canGoNext }}
            disabled={!canGoNext}
            onPress={onNext}
            style={({ pressed }) => [
              styles.sideBtn,
              !canGoNext && styles.sideBtnDisabled,
              pressed && canGoNext && styles.pressed,
            ]}
          >
            <SkipForward size={28} color={canGoNext ? amColors.white : "rgba(255,255,255,0.35)"} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: driveRepeat }}
          accessibilityLabel={
            driveRepeat
              ? "Repeat this song on — tap to continue to next song when finished"
              : "Repeat this song off — tap to loop this song in drive mode"
          }
          onPress={onToggleDriveRepeat}
          style={({ pressed }) => [styles.repeatBtn, driveRepeat && styles.repeatBtnOn, pressed && styles.pressed]}
        >
          <Repeat size={22} color={driveRepeat ? amColors.white : "rgba(255,255,255,0.85)"} />
          <Text style={[styles.repeatLabel, driveRepeat && styles.repeatLabelOn]}>
            {driveRepeat ? "Repeat song on" : "Repeat song"}
          </Text>
        </Pressable>

        {isBuffering ? (
          <Text style={styles.buffering} role="status">Loading audio…</Text>
        ) : null}
      </View>
      </View>
    </View>
  )
}

const makeStyles = (theme: AmTheme) => StyleSheet.create({
  cardOuter: {
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    ...(Platform.OS === "android" ? { elevation: 3 } : softShadow(2)),
  },
  card: {
    minHeight: 320,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: theme.inner,
  },
  inner: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  captions: {
    gap: spacing.xs,
  },
  /** dark scrim (amScrimPhoto) behind the captions so they reach 4.5:1 on any photo */
  captionsScrim: {
    position: "absolute",
    top: -spacing.lg,
    left: -spacing.lg,
    right: -spacing.lg,
    bottom: -spacing.md,
  },
  eyebrow: {
    ...typography.caption,
    color: "rgba(255,255,255,0.82)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  number: {
    ...typography.caption,
    color: "#f5d9a8",
    fontFamily: "Inter_600SemiBold",
  },
  title: {
    fontFamily: "Lora_700Bold",
    fontSize: 28,
    lineHeight: 34,
    color: amColors.white,
  },
  line: {
    ...typography.bodySmall,
    color: "rgba(255,255,255,0.85)",
    marginBottom: spacing.md,
  },
  seekWrap: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  time: {
    ...typography.caption,
    color: "rgba(255,255,255,0.8)",
    fontVariant: ["tabular-nums"],
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  playBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  sideBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  sideBtnDisabled: {
    opacity: 0.55,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  buffering: {
    ...typography.caption,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    marginTop: spacing.sm,
  },
  repeatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    alignSelf: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  repeatBtnOn: {
    backgroundColor: theme.brand,
    borderColor: "rgba(255,255,255,0.4)",
  },
  repeatLabel: {
    ...typography.caption,
    color: "rgba(255,255,255,0.85)",
  },
  repeatLabelOn: {
    color: amColors.white,
    fontFamily: "Inter_600SemiBold",
  },
})
