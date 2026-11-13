import { useMemo, useState } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import type { MemberPlaylist } from "@prabhat/core"
import { ChevronDown, ChevronRight, Play } from "lucide-react-native"

import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import type { AmTheme } from "@/constants/tokens/amColors"
import { useAmTheme } from "@/hooks/useAmTheme"
import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { playlistSongNumbers } from "@/lib/playPlaylist"
import { usePlayerStore } from "@/stores/playerStore"

type Props = {
  playlists: MemberPlaylist[]
  onPlayPlaylist: (playlist: MemberPlaylist, startAt?: number) => void
}

export function DrivePlaylistAccordion({ playlists, onPlayPlaylist }: Props) {
  const theme = useAmTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const currentNumber = usePlayerStore((s) => s.currentSong?.number ?? null)

  const titleByPlaylist = useMemo(() => {
    const map = new Map<string, Map<number, string>>()
    for (const playlist of playlists) {
      const numbers = playlistSongNumbers(playlist)
      const hits = catalogSongsByNumbers(numbers, numbers.length)
      const byNumber = new Map(hits.map((hit) => [hit.number, hit.firstLine || hit.title]))
      map.set(playlist.id, byNumber)
    }
    return map
  }, [playlists])

  if (!playlists.length) return null

  return (
    <View style={styles.wrap}>
      {playlists.map((playlist) => {
        const expanded = expandedId === playlist.id
        const numbers = playlistSongNumbers(playlist)
        const titles = titleByPlaylist.get(playlist.id)
        return (
          <View key={playlist.id} style={styles.block}>
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={expanded ? `Collapse ${playlist.name}` : `Expand ${playlist.name}`}
                accessibilityState={{ expanded }}
                onPress={() => setExpandedId((id) => (id === playlist.id ? null : playlist.id))}
                style={({ pressed }) => [styles.headerMain, pressed && styles.pressed]}
              >
                {expanded ? (
                  <ChevronDown size={20} color={theme.textBody} />
                ) : (
                  <ChevronRight size={20} color={theme.textBody} />
                )}
                <View style={styles.headerText}>
                  <Text style={styles.playlistName}>{playlist.name}</Text>
                  <Text style={styles.meta}>
                    {numbers.length ? `${numbers.length} songs` : "Empty playlist"}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play ${playlist.name}`}
                disabled={!numbers.length}
                onPress={() => onPlayPlaylist(playlist)}
                style={({ pressed }) => [
                  styles.playBtn,
                  !numbers.length && styles.playBtnDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Play size={18} color={numbers.length ? theme.accentText : theme.textMuted} />
              </Pressable>
            </View>
            {expanded ? (
              <View style={styles.songs}>
                {!numbers.length ? (
                  <Text style={styles.emptySong}>Add songs from the Saved tab or any song page.</Text>
                ) : (
                  numbers.map((number) => {
                    const isCurrent = currentNumber === number
                    const title = titles?.get(number) ?? `Prabhat Samgiita ${number}`
                    return (
                      <Pressable
                        key={`${playlist.id}-${number}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Play PS ${number}, ${title}`}
                        onPress={() => onPlayPlaylist(playlist, number)}
                        style={({ pressed }) => [
                          styles.songRow,
                          isCurrent && styles.songRowCurrent,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.songNumber, isCurrent && styles.songNumberCurrent]}>
                          PS {number}
                        </Text>
                        <Text style={styles.songTitle} numberOfLines={1}>{title}</Text>
                        {isCurrent ? <Text style={styles.now}>Now</Text> : null}
                      </Pressable>
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

const makeStyles = (theme: AmTheme) => StyleSheet.create({
  wrap: { gap: spacing.sm },
  block: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    backgroundColor: theme.card,
    overflow: "hidden",
    ...(Platform.OS === "android" ? { elevation: 0 } : null),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
  },
  headerMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerText: { flex: 1, minWidth: 0 },
  playlistName: { ...typography.h3, color: theme.textHeading },
  meta: { ...typography.caption, color: theme.textBody, marginTop: 2 },
  playBtn: {
    width: 44,
    height: 44,
    marginRight: spacing.sm,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.line,
  },
  playBtnDisabled: { opacity: 0.45 },
  songs: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.line,
    backgroundColor: theme.card,
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  songRowCurrent: { backgroundColor: theme.inner },
  songNumber: { ...typography.caption, color: theme.textBody, width: 52 },
  songNumberCurrent: { color: theme.accentText, fontFamily: "Inter_600SemiBold" },
  songTitle: { ...typography.bodySmall, color: theme.textHeading, flex: 1 },
  now: { ...typography.caption, color: theme.accentText, fontFamily: "Inter_600SemiBold" },
  emptySong: {
    ...typography.bodySmall,
    color: theme.textBody,
    padding: spacing.md,
  },
  pressed: { opacity: 0.9 },
})
