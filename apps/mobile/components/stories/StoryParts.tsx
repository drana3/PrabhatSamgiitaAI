import { memo, type ReactNode } from "react"
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import Svg, { Path } from "react-native-svg"

import { ChevronRightGlyph } from "@/components/songs-v2/Glyphs"
import { Press } from "@/components/songs-v2/Press"
import { amPhotoChip, amScrimPhoto, amScrimPhotoTop } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { moodForText, photoForSeed, type StockPhoto } from "@/lib/photos/catalog"
import { keepPsTogether } from "@/lib/stories/body"
import { primarySong, type Story } from "@/lib/stories/types"
import { readTimeLabel } from "@/lib/stories/readTime"

/** The photo a story always gets: stable by its slug, warm, no faces (lib/photos/pick). */
export function storyPhoto(story: Pick<Story, "slug" | "title">, size: "small" | "large"): StockPhoto | undefined {
  return photoForSeed(story.slug, moodForText(story.title), { size })
}

export function CheckGlyph({ size = 14, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function ShareGlyph({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15V4M8 8l4-4 4 4M6 12v6.5c0 .8.7 1.5 1.5 1.5h9c.8 0 1.5-.7 1.5-1.5V12"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** The picture of a story, in a box of the given size. Grey-warm ground while the photo loads. */
export function StoryPicture({
  story,
  size,
  tint,
  style,
}: {
  story: Pick<Story, "slug" | "title">
  size: "small" | "large"
  tint: string
  style?: StyleProp<ViewStyle>
}) {
  const photo = storyPhoto(story, size)
  return (
    <View style={[{ backgroundColor: tint, overflow: "hidden" }, style]}>
      {photo ? (
        <Image
          source={size === "small" ? photo.thumb : photo.cover}
          contentFit="cover"
          accessibilityIgnoresInvertColors
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  )
}

/** Dark glass chip with white text: the only chip allowed over a photograph. */
export function PhotoChip({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <View style={[styles.photoChip, { backgroundColor: amPhotoChip.glass.bg }]}>
      {icon}
      <Text style={[styles.photoChipText, { color: amPhotoChip.glass.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

/** `PS 3 · Song title`, or just the song number while the title is not known. */
export function songLine(story: Story, songTitle: (n: number) => string | undefined): string {
  const n = primarySong(story)
  if (!n) return ""
  const title = songTitle(n)?.trim()
  return title ? `PS ${n} · ${title}` : `PS ${n}`
}

export function storyA11y(story: Story, line: string, minutes: number | null, read: boolean): string {
  return [story.title, line && `about ${line}`, readTimeLabel(minutes), read ? "read" : "not read yet"].filter(Boolean).join(", ")
}

/* ---------------------------------------------------------------- featured */

const FEATURED_HEIGHT = 340

/**
 * The first story to read: a tall photo card. Everything written on it sits on scrims (a flat dim over the
 * whole photo, a gradient from the bottom), chips are dark glass, the button is white with ink text.
 */
export const FeaturedStoryCard = memo(function FeaturedStoryCard({
  theme,
  story,
  line,
  minutes,
  read,
  onOpen,
}: {
  theme: SongsTheme
  story: Story
  line: string
  minutes: number | null
  read: boolean
  onOpen: (story: Story) => void
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`Featured story. ${storyA11y(story, line, minutes, read)}`}
      onPress={() => onOpen(story)}
      pressedScale={0.985}
      outerStyle={styles.featuredOuter}
      style={styles.featured}
    >
      <StoryPicture story={story} size="large" tint={theme.inner} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />
      <LinearGradient colors={amScrimPhotoTop} style={styles.scrimTop} pointerEvents="none" />
      <LinearGradient colors={amScrimPhoto} style={styles.scrimBottom} pointerEvents="none" />
      <View style={styles.featuredTop}>
        <PhotoChip label={read ? "Featured · read" : "Featured"} />
      </View>
      <View style={styles.featuredBottom}>
        {line ? (
          <Text style={styles.featuredSong} numberOfLines={1}>
            {line}
          </Text>
        ) : null}
        <Text style={styles.featuredTitle} numberOfLines={3} accessibilityRole="header">
          {keepPsTogether(story.title)}
        </Text>
        <View style={styles.featuredFoot}>
          {minutes ? <PhotoChip label={readTimeLabel(minutes)} /> : <View />}
          <View style={styles.readPill}>
            <Text style={styles.readPillText}>{read ? "Read again" : "Read the story"}</Text>
            <ChevronRightGlyph size={18} color={amPhotoChip.white.fg} />
          </View>
        </View>
      </View>
    </Press>
  )
})

/* --------------------------------------------------------------------- row */

const THUMB = 84

/** One story in the list: picture, title, the song it is about, minutes and whether it was read. */
export const StoryRow = memo(function StoryRow({
  theme,
  story,
  line,
  minutes,
  read,
  onOpen,
}: {
  theme: SongsTheme
  story: Story
  line: string
  minutes: number | null
  read: boolean
  onOpen: (story: Story) => void
}) {
  const time = readTimeLabel(minutes)
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={storyA11y(story, line, minutes, read)}
      onPress={() => onOpen(story)}
      pressedScale={0.98}
      outerStyle={styles.rowOuter}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View style={styles.thumbWrap}>
        <StoryPicture story={story} size="small" tint={theme.inner} style={styles.thumb} />
        {read ? (
          <View style={[styles.readBadge, { backgroundColor: amPhotoChip.glass.bg }]}>
            <CheckGlyph size={13} color={amPhotoChip.glass.fg} />
          </View>
        ) : null}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: read ? theme.textBody : theme.textHeading }]} numberOfLines={2}>
          {keepPsTogether(story.title)}
        </Text>
        {line ? (
          <Text style={[styles.rowSong, { color: theme.accentText }]} numberOfLines={1}>
            {line}
          </Text>
        ) : null}
        <View style={styles.rowMeta}>
          {!read ? <View style={[styles.dot, { backgroundColor: theme.accentBright }]} /> : null}
          <Text style={[styles.rowMetaText, { color: theme.textBody }]} numberOfLines={1}>
            {[time, read ? "Read" : "New"].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </View>
      <ChevronRightGlyph size={20} color={theme.textMuted} />
    </Press>
  )
})

const styles = StyleSheet.create({
  photoChip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  photoChipText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 17 },
  featuredOuter: { marginHorizontal: 16 },
  featured: { height: FEATURED_HEIGHT, borderRadius: 28, overflow: "hidden", justifyContent: "space-between" },
  dim: { backgroundColor: "rgba(0,0,0,0.16)" },
  scrimTop: { position: "absolute", left: 0, right: 0, top: 0, height: 96 },
  scrimBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 230 },
  featuredTop: { padding: 16 },
  featuredBottom: { padding: 20, gap: 8 },
  featuredSong: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 17, color: "#FFFFFF", letterSpacing: 0.2 },
  featuredTitle: {
    fontFamily: amFonts.display,
    fontSize: 30,
    lineHeight: 31,
    letterSpacing: -0.6,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  featuredFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  readPill: {
    height: 40,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: amPhotoChip.white.bg,
  },
  readPillText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18, color: amPhotoChip.white.fg },
  rowOuter: { marginHorizontal: 16, marginBottom: 10 },
  row: { borderRadius: 22, borderWidth: 1, padding: 8, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 14 },
  thumbWrap: { width: THUMB, height: THUMB },
  thumb: { width: THUMB, height: THUMB, borderRadius: 16 },
  readBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  rowSong: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowMetaText: { fontFamily: amFonts.regular, fontSize: 13, lineHeight: 17, fontVariant: ["tabular-nums"] },
})
