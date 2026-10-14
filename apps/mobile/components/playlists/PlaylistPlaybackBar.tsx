import { Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { ListMusic, SkipBack, SkipForward } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous in playlist"
          onPress={() => previous()}
          hitSlop={8}
          style={styles.iconBtn}
        >
          <SkipBack size={20} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next in playlist"
          onPress={() => next()}
          hitSlop={8}
          style={styles.iconBtn}
        >
          <SkipForward size={20} color={colors.textPrimary} />
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
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
})
