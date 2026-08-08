import { Pressable, StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Clapperboard, Headphones, Pause, Sparkles } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import type { MockSong } from "@/data/mock"
import { songPlayback } from "@/lib/playback"
import { usePlayerStore } from "@/stores/playerStore"

type Props = {
  song: MockSong
  onPress: () => void
  onWatch?: () => void
  onAskAi?: () => void
  playQueue?: number[]
}

export function TodaySongCard({ song, onPress, onWatch, onAskAi, playQueue }: Props) {
  const showPause = usePlayerStore((s) => songPlayback(s, song).showPause)
  const playOrToggle = usePlayerStore((s) => s.playOrToggle)
  const hasVideo = song.videos.some((video) => video.embedUrl)

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Today's song PS ${song.number}`}
        onPress={onPress}
        style={({ pressed }) => [styles.cardPress, pressed && styles.pressed]}
      >
        <Image source={{ uri: song.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["rgba(20,14,10,0.12)", "rgba(20,14,10,0.78)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Today’s Prabhat Samgiita</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.number}>PS {song.number}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={styles.themes} numberOfLines={1}>
            {song.themes.join(" · ")}
          </Text>
        </View>
      </Pressable>

      <View style={styles.actions} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPause ? `Pause PS ${song.number}` : `Listen to PS ${song.number}`}
          onPress={() => playOrToggle(song, playQueue)}
          style={({ pressed }) => [styles.listenBtn, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          {showPause ? (
            <Pause size={18} color={colors.white} fill={colors.white} />
          ) : (
            <Headphones size={18} color={colors.white} />
          )}
          <Text style={styles.listenText}>{showPause ? "Pause" : "Listen"}</Text>
        </Pressable>
        {onWatch && hasVideo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Watch PS ${song.number}`}
            onPress={onWatch}
            style={({ pressed }) => [styles.watchBtn, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            <Clapperboard size={16} color={colors.white} />
            <Text style={styles.watchText}>Watch</Text>
          </Pressable>
        ) : null}
        {onAskAi ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ask AI about PS ${song.number}`}
            hitSlop={8}
            onPressIn={onAskAi}
            style={({ pressed }) => [styles.aiBtn, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            <Sparkles size={16} color={colors.white} />
            <Text style={styles.aiText}>Ask AI</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1.55,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.surfaceWarm,
    ...softShadow(2),
  },
  cardPress: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.96,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...typography.caption,
    color: colors.white,
  },
  meta: {
    marginBottom: 56,
  },
  number: {
    ...typography.caption,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 2,
  },
  title: {
    fontFamily: "Lora_700Bold",
    fontSize: 22,
    lineHeight: 28,
    color: colors.white,
  },
  themes: {
    ...typography.bodySmall,
    color: "rgba(255,255,255,0.82)",
    marginTop: 4,
  },
  actions: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    zIndex: 3,
  },
  listenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 40,
  },
  listenText: {
    ...typography.label,
    color: colors.white,
  },
  watchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(20,14,10,0.55)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 40,
  },
  watchText: {
    ...typography.label,
    color: colors.white,
  },
  aiBtn: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(212, 146, 58, 0.92)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
    zIndex: 4,
    elevation: 4,
  },
  aiText: {
    ...typography.label,
    color: colors.white,
  },
})
