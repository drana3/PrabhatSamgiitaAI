import { useMemo, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import type { MemberPlaylist } from "@prabhat/core"
import { ChevronDown, ChevronRight, ListMusic, Plus } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { playlistSongNumbers } from "@/lib/playPlaylist"
import { formatPlaylistCreatedLabel, sortPlaylistsNewestFirst } from "@/lib/playlistDisplay"
import { playlistNowPlayingRowMeta } from "@/lib/playlistPlayback"
import { usePlayerStore } from "@/stores/playerStore"

type Props = {
  playlists: MemberPlaylist[]
  songNumber: number
  addingId: string | null
  onAdd: (playlistId: string) => void
}

export function AddToPlaylistList({ playlists, songNumber, addingId, onAdd }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const activePlaylist = usePlayerStore((s) => s.activePlaylist)
  const playlistBounds = usePlayerStore((s) => s.playlistBounds)
  const currentNumber = usePlayerStore((s) => s.currentSong?.number ?? null)

  const sorted = useMemo(() => sortPlaylistsNewestFirst(playlists), [playlists])

  const titleByPlaylist = useMemo(() => {
    const map = new Map<string, Map<number, string>>()
    for (const playlist of sorted) {
      const numbers = playlistSongNumbers(playlist)
      const hits = catalogSongsByNumbers(numbers, numbers.length)
      const byNumber = new Map(hits.map((hit) => [hit.number, hit.firstLine || hit.title]))
      map.set(playlist.id, byNumber)
    }
    return map
  }, [sorted])

  if (!sorted.length) {
    return (
      <Text style={styles.empty}>No playlists yet — create one below.</Text>
    )
  }

  return (
    <View style={styles.wrap}>
      {sorted.map((playlist) => {
        const expanded = expandedId === playlist.id
        const numbers = playlistSongNumbers(playlist)
        const titles = titleByPlaylist.get(playlist.id)
        const createdLabel = formatPlaylistCreatedLabel(playlist)
        const alreadyHasSong = playlist.songs.some((row) => row.song_number === songNumber)
        const playingMeta = playlistNowPlayingRowMeta(
          playbackMode,
          activePlaylist?.id,
          playlist.id,
          playlistBounds,
          currentNumber,
        )
        const isUnderPlay = Boolean(playingMeta)
        const busy = addingId === playlist.id

        return (
          <View
            key={playlist.id}
            style={[styles.block, isUnderPlay && styles.blockPlaying]}
          >
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={expanded ? `Collapse ${playlist.name}` : `Expand ${playlist.name}`}
                accessibilityState={{ expanded }}
                onPress={() => setExpandedId((id) => (id === playlist.id ? null : playlist.id))}
                style={({ pressed }) => [styles.headerMain, pressed && styles.pressed]}
              >
                {isUnderPlay ? (
                  <ListMusic size={18} color={colors.primaryDark} />
                ) : expanded ? (
                  <ChevronDown size={20} color={colors.textSecondary} />
                ) : (
                  <ChevronRight size={20} color={colors.textSecondary} />
                )}
                <View style={styles.headerText}>
                  <Text style={[styles.name, isUnderPlay && styles.namePlaying]} numberOfLines={2}>
                    {playlist.name}
                  </Text>
                  <Text style={[styles.meta, isUnderPlay && styles.metaPlaying]} numberOfLines={2}>
                    {playingMeta ??
                      [
                        createdLabel,
                        `${numbers.length} song${numbers.length === 1 ? "" : "s"}`,
                        alreadyHasSong ? "Already has this song" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  alreadyHasSong
                    ? `${playlist.name} already contains PS ${songNumber}`
                    : `Add PS ${songNumber} to ${playlist.name}`
                }
                disabled={busy || alreadyHasSong}
                onPress={() => onAdd(playlist.id)}
                style={({ pressed }) => [
                  styles.addBtn,
                  (busy || alreadyHasSong) && styles.addBtnDisabled,
                  pressed && !busy && !alreadyHasSong && styles.pressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                ) : (
                  <Plus size={20} color={alreadyHasSong ? colors.textMuted : colors.primaryDark} />
                )}
              </Pressable>
            </View>
            {expanded ? (
              <View style={styles.songs}>
                {!numbers.length ? (
                  <Text style={styles.emptySongs}>Empty playlist</Text>
                ) : (
                  numbers.map((number) => {
                    const isTarget = number === songNumber
                    const title = titles?.get(number) ?? `Prabhat Samgiita ${number}`
                    return (
                      <View
                        key={`${playlist.id}-${number}`}
                        style={[styles.songRow, isTarget && styles.songRowTarget]}
                      >
                        <Text style={[styles.songNumber, isTarget && styles.songNumberTarget]}>
                          PS {number}
                        </Text>
                        <Text style={styles.songTitle} numberOfLines={1}>{title}</Text>
                        {isTarget ? (
                          <Text style={styles.songBadge}>This song</Text>
                        ) : null}
                      </View>
                    )
                  })
                )}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  empty: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  block: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  blockPlaying: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  headerMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    minWidth: 0,
  },
  headerText: { flex: 1, minWidth: 0 },
  name: { ...typography.label, color: colors.textPrimary },
  namePlaying: { color: colors.primaryDark },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  metaPlaying: { color: colors.textSecondary, fontFamily: "Inter_600SemiBold" },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },
  addBtnDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  songs: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  emptySongs: { ...typography.caption, color: colors.textMuted, paddingVertical: spacing.sm },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  songRowTarget: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  songNumber: { ...typography.caption, color: colors.textMuted, width: 52 },
  songNumberTarget: { color: colors.primaryDark, fontFamily: "Inter_600SemiBold" },
  songTitle: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  songBadge: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
})
