import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { ListMusic, SkipBack, SkipForward } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { canStepPlaylist } from "@/lib/playbackQueue"
import { playlistPlaybackSubtitle } from "@/lib/playlistPlayback"
import { usePlayerStore } from "@/stores/playerStore"
import { href } from "@/utils/href"

type Props = {
  /** When set, bar only appears if this song is part of the active playlist queue. */
  songNumber?: number
}

export function PlaylistPlaybackBar({ songNumber }: Props) {
  const router = useRouter()
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const bounds = usePlayerStore((s) => s.playlistBounds)
  const current = usePlayerStore((s) => s.currentSong)
  const activePlaylist = usePlayerStore((s) => s.activePlaylist)
  const next = usePlayerStore((s) => s.next)
  const previous = usePlayerStore((s) => s.previous)
  const isBuffering = usePlayerStore((s) => s.isBuffering)
  const canGoNext = canStepPlaylist(playbackMode, current?.number ?? null, bounds, 1)
  const canGoPrevious = canStepPlaylist(playbackMode, current?.number ?? null, bounds, -1)

  const subtitle = playlistPlaybackSubtitle(
    playbackMode,
    bounds,
    current?.number ?? null,
    activePlaylist,
  )
  if (playbackMode !== "playlist" || !subtitle || !bounds?.length) return null
  if (songNumber != null && !bounds.includes(songNumber)) return null

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open playlist"
        disabled={!activePlaylist?.id}
        onPress={() => {
          if (activePlaylist?.id) router.push(href(`/playlist/${activePlaylist.id}`))
        }}
        style={styles.meta}
      >
        <ListMusic size={18} color={colors.primaryDark} />
        <Text style={styles.label} numberOfLines={1}>{subtitle}</Text>
      </Pressable>
      <View style={styles.transport}>
        {isBuffering ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous in playlist"
          accessibilityState={{ disabled: !canGoPrevious }}
          disabled={!canGoPrevious}
          onPress={() => previous()}
          hitSlop={8}
          style={[styles.iconBtn, !canGoPrevious && styles.iconBtnDisabled]}
        >
          <SkipBack size={20} color={canGoPrevious ? colors.textPrimary : colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next in playlist"
          accessibilityState={{ disabled: !canGoNext }}
          disabled={!canGoNext}
          onPress={() => next()}
          hitSlop={8}
          style={[styles.iconBtn, !canGoNext && styles.iconBtnDisabled]}
        >
          <SkipForward size={20} color={canGoNext ? colors.textPrimary : colors.textMuted} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  meta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  transport: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  spinner: { marginRight: spacing.xs },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  iconBtnDisabled: { opacity: 0.45 },
})
