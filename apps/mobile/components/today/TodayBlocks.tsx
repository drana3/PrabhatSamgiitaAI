import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { ChevronRight, Play, Search } from "lucide-react-native"

import { PressScale } from "@/components/today/motion"
import { brandAssets } from "@/constants/brand"
import { amRadius, amControl, amGap, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import type { MockSong } from "@/data/mock"
import { resumeProgress, TODAY_FIND_ROWS } from "@/lib/todayView"

type ThemeProps = { theme: AmTheme }

/** Top bar, 56px: mark and wordmark on the left, avatar button on the right. */
export function TodayTopBar({
  theme,
  initials,
  onAvatar,
}: ThemeProps & { initials: string; onAvatar: () => void }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.brand}>
        <Image source={brandAssets.emblemClear} style={styles.mark} contentFit="contain" />
        <Text style={[amType.label, { color: theme.textHeading }]}>Prabhat Samgiita</Text>
      </View>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Profile"
        onPress={onAvatar}
        style={[styles.avatar, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <Text style={[amType.label, { color: theme.textHeading, letterSpacing: 0 }]}>{initials}</Text>
      </PressScale>
    </View>
  )
}

/** A field, not an icon: users did not find the old search icon. */
export function TodaySearchPill({ theme, onPress }: ThemeProps & { onPress: () => void }) {
  return (
    <PressScale
      accessibilityRole="search"
      accessibilityLabel="Search a number, a name or a feeling"
      onPress={onPress}
      pressedScale={0.985}
      style={[styles.search, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <Search size={20} color={theme.textBody} />
      <Text style={[amType.body, { color: theme.textMuted }]} numberOfLines={1}>
        Search a number, a name or a feeling
      </Text>
    </PressScale>
  )
}

/** Heading in two tones: the first line in ink, the second in a lighter ink. */
export function TwoToneHeading({
  theme,
  first,
  second,
}: ThemeProps & { first: string; second: string }) {
  return (
    <Text style={[amType.title, styles.heading]} accessibilityRole="header">
      <Text style={{ color: theme.textHeading }}>{first}</Text>
      {"\n"}
      <Text style={{ color: amColors.ink300 }}>{second}</Text>
    </Text>
  )
}

/** "Pick up where you stopped". Progress is only known for the song loaded in the player. */
export function ResumeCard({
  theme,
  song,
  kind,
  positionSeconds,
  durationSeconds,
  onPlay,
  onOpen,
}: ThemeProps & {
  song: MockSong
  kind: "resume" | "songOfDay"
  positionSeconds: number
  durationSeconds: number
  onPlay: () => void
  onOpen: () => void
}) {
  const progress = resumeProgress(positionSeconds, durationSeconds)
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${kind === "resume" ? "Resume" : "Song of the day"} PS ${song.number}, ${song.title}`}
      onPress={onOpen}
      pressedScale={0.985}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View style={styles.cardCopy}>
        <Text style={[amType.label, { color: theme.eyebrow }]}>PS {song.number}</Text>
        <Text style={[styles.rowTitle, { color: theme.textHeading }]}>{song.title}</Text>
        {kind === "resume" ? (
          <View style={[styles.track, { backgroundColor: theme.inner }]}>
            <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: theme.brand }]} />
          </View>
        ) : null}
      </View>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={kind === "resume" ? "Resume playing" : "Play"}
        onPress={onPlay}
        pressedScale={0.92}
        style={[styles.disc, { backgroundColor: theme.brand }]}
      >
        <Play size={20} color={theme.onBrand} fill={theme.onBrand} />
      </PressScale>
    </PressScale>
  )
}

/** "Find a song your way": three rows that open search. */
export function FindWayRows({ theme, onOpen }: ThemeProps & { onOpen: (href: string) => void }) {
  return (
    <View style={styles.stack}>
      {TODAY_FIND_ROWS.map((row) => (
        <PressScale
          key={row.id}
          accessibilityRole="button"
          accessibilityLabel={`Search ${row.title.toLowerCase()}`}
          onPress={() => onOpen(row.href)}
          pressedScale={0.985}
          style={[styles.findRow, { backgroundColor: theme.card, borderColor: theme.line }]}
        >
          <View style={styles.cardCopy}>
            <Text style={[styles.rowTitle, { color: theme.textHeading }]}>{row.title}</Text>
            <Text style={[amType.body, { color: theme.textBody }]}>{row.hint}</Text>
          </View>
          <ChevronRight size={20} color={theme.textMuted} />
        </PressScale>
      ))}
    </View>
  )
}

/** "Story of the week": one olive 30px card, opens the story sheet. */
export function StoryCard({
  title,
  readTime,
  onPress,
}: {
  title: string
  readTime?: string
  onPress: () => void
}) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`Story of the week: ${title}`}
      onPress={onPress}
      pressedScale={0.985}
      style={[styles.story, { backgroundColor: amColors.olive100 }]}
    >
      <Text style={[amType.label, { color: amColors.olive700 }]}>Story of the week{readTime ? ` · ${readTime}` : ""}</Text>
      <Text style={[styles.storyTitle, { color: amColors.sage900 }]}>{title}</Text>
    </PressScale>
  )
}

/** Three recent songs as rows. Titles wrap to two lines instead of truncating. */
export function RecentRows({
  theme,
  songs,
  onOpen,
}: ThemeProps & { songs: MockSong[]; onOpen: (song: MockSong) => void }) {
  return (
    <View style={styles.stack}>
      {songs.map((song) => (
        <PressScale
          key={song.id}
          accessibilityRole="button"
          accessibilityLabel={`PS ${song.number}, ${song.title}`}
          onPress={() => onOpen(song)}
          pressedScale={0.985}
          style={[styles.findRow, { backgroundColor: theme.card, borderColor: theme.line }]}
        >
          <View style={styles.cardCopy}>
            <Text style={[amType.label, { color: theme.eyebrow }]}>PS {song.number}</Text>
            <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={2}>
              {song.title}
            </Text>
          </View>
        </PressScale>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  mark: { width: 28, height: 28 },
  avatar: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amTouchTarget / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    height: 56,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  heading: { marginBottom: amGap.block },
  card: {
    borderRadius: amRadius.card,
    borderWidth: 1,
    padding: amGap.padCard,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  cardCopy: { flex: 1, gap: 6 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 24 },
  track: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 6 },
  fill: { height: 4, borderRadius: 2 },
  disc: {
    width: amControl.pillHeight,
    height: amControl.pillHeight,
    borderRadius: amControl.pillHeight / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: { gap: amGap.grid },
  findRow: {
    minHeight: 64,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amGap.padCard,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  story: { borderRadius: amRadius.panel, padding: amGap.padPanel, gap: 10 },
  storyTitle: { fontFamily: amFonts.bold, fontSize: 24, lineHeight: 28 },
})
