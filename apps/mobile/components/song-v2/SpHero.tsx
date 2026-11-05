import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import { Image as ExpoImage } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from "react-native-reanimated"
import Svg, { Circle } from "react-native-svg"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SaveButton } from "@/components/save/SaveButton"
import { coverFor } from "@/components/player-v2/playerCovers"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { SaveItem } from "@/lib/save/saveToSheet"
import { songAccents } from "@/lib/songPage/accent"
import { coverTransform } from "@/lib/songPage/stickyBar"
import type { DownloadPhase } from "@/lib/songPage/versions"

import { SpIcon } from "./SpIcon"
import { SpPress } from "./SpUi"

/** Height of the wash below the page top. */
export const SP_WASH_HEIGHT = 560

/** Top of the big Play button inside the action row, and its size (row padding-top 10, button 64). */
export const SP_PLAY_TOP = 10
export const SP_PLAY_SIZE = 64
/** Padding above the title in the text block. */
export const SP_HERO_TEXT_TOP = 22

/**
 * The tinted wash behind the hero. It reaches 700px above the page so the iOS rubber band shows the
 * tint and not a white strip, and fades into the page colour at the bottom.
 */
export function SpHeroWash({ top, page }: { top: string; page: string }) {
  return (
    <View pointerEvents="none" style={styles.washBox}>
      <LinearGradient colors={[top, top, page]} locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill} />
    </View>
  )
}

/**
 * Big square cover, centered, ~58% of the width. Depth comes from a blurred copy of the picture behind it
 * (its own colours as a glow), not a shadow. It shrinks and fades with the scroll and swells a little when the
 * page is pulled down, all by transform and opacity on the UI thread.
 */
export function SpHeroCover({
  songNumber,
  size,
  scrollY,
  onLayout,
  radius,
}: {
  songNumber: number
  size: number
  scrollY: SharedValue<number>
  onLayout: (event: LayoutChangeEvent) => void
  radius: number
}) {
  const cover = coverFor(songNumber)
  const reduce = useReducedMotion()
  const animated = useAnimatedStyle(() => {
    const c = coverTransform(scrollY.value, size)
    return { opacity: c.opacity, transform: [{ translateY: c.lift }, { scale: reduce ? 1 : c.scale }] }
  })
  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.coverBox, { width: size, height: size }, animated]}
      accessibilityRole="image"
      accessibilityLabel={`Cover of song ${songNumber}`}
    >
      <ExpoImage
        source={cover.source}
        contentFit="cover"
        contentPosition={cover.position}
        blurRadius={36}
        style={[styles.glow, { width: size, height: size, borderRadius: radius }, GLOW_WEB]}
      />
      <ExpoImage
        source={cover.source}
        contentFit="cover"
        contentPosition={cover.position}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    </Animated.View>
  )
}

/** Title (800, caps), `PS 1 · Prabhat Samgiita`, the performer, and the meta line. */
export function SpHeroText({
  t,
  title,
  collectionLine,
  performer,
  meta,
  onPerformer,
  onMeta,
  onTitleLayout,
}: {
  t: SpTheme
  title: string
  collectionLine: string
  performer: string
  meta: string
  onPerformer?: () => void
  onMeta?: () => void
  onTitleLayout?: (event: LayoutChangeEvent) => void
}) {
  return (
    <View style={styles.text}>
      <Text style={[styles.h1, { color: t.ink900 }]} accessibilityRole="header" onLayout={onTitleLayout}>
        {title}
      </Text>
      <Text style={[styles.line, { color: t.ink500, fontVariant: ["tabular-nums"] }]} numberOfLines={1}>
        {collectionLine}
      </Text>
      {performer ? (
        <SpPress
          onPress={onPerformer}
          accessibilityLabel={`Performer ${performer}. Show the versions`}
          style={styles.perfHit}
        >
          <Text style={[styles.performer, { color: t.ink900 }]} numberOfLines={1}>
            {performer}
          </Text>
        </SpPress>
      ) : null}
      {meta ? (
        <SpPress onPress={onMeta} accessibilityLabel={`${meta}. Show the versions`} style={styles.metaHit}>
          <Text style={[styles.meta, { color: t.ink500, fontVariant: ["tabular-nums"] }]} numberOfLines={1}>
            {meta}
          </Text>
        </SpPress>
      ) : null}
    </View>
  )
}

/** expo-image's blurRadius is native only; the web build blurs the glow with a CSS filter. */
const GLOW_WEB = (Platform.OS === "web" ? { filter: "blur(30px)" } : null) as object | null

const RING = 30
const RING_R = 12.5
const RING_C = 2 * Math.PI * RING_R

/** Download glyph with a progress ring and the percent inside while it saves; a check in orange when saved. */
function DownloadGlyph({ t, phase, progress }: { t: SpTheme; phase: DownloadPhase; progress: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100)
  if (phase === "idle") return <SpIcon name="download" size={24} color={t.ink800} />
  const accent = songAccents(t)
  if (phase === "saved") {
    return (
      <View style={[styles.savedDot, { backgroundColor: accent.fill }]}>
        <SpIcon name="check" size={16} color={accent.onFill} strokeWidth={2.6} />
      </View>
    )
  }
  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={t.sand400} strokeWidth={2.5} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_R}
          stroke={accent.bright}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${RING_C} ${RING_C}`}
          strokeDashoffset={RING_C * (1 - Math.max(0.04, Math.min(1, progress)))}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text style={[styles.pct, { color: t.ink900 }]}>{pct}</Text>
    </View>
  )
}

function Tool({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <SpPress onPress={onPress} accessibilityLabel={label} style={styles.tool} pressedScale={0.9}>
      {children}
    </SpPress>
  )
}

/**
 * The action row of the Spotify track page: small icons on the left (save, download, add to playlist, share,
 * more), the big round orange Play / Pause on the right.
 */
export function SpActionRow({
  t,
  saveItem,
  showDownload,
  phase,
  progress,
  downloadLabel,
  onDownload,
  onPlaylist,
  onShare,
  onMore,
  playing,
  onPlay,
  onLayout,
}: {
  t: SpTheme
  /** The song, for the circle-plus that opens the "Save to" sheet. */
  saveItem: SaveItem | null
  showDownload: boolean
  phase: DownloadPhase
  progress: number
  downloadLabel: string
  onDownload: () => void
  onPlaylist: () => void
  onShare: () => void
  onMore: () => void
  playing: boolean
  onPlay: () => void
  /** The row's place in the page: the bar's Play button appears as the big one leaves. */
  onLayout?: (event: LayoutChangeEvent) => void
}) {
  const accent = songAccents(t)
  return (
    <View style={styles.actions} onLayout={onLayout}>
      <View style={styles.tools}>
        {saveItem ? <SaveButton item={saveItem} size={28} color={t.ink800} /> : null}
        {showDownload ? (
          <Tool label={downloadLabel} onPress={onDownload}>
            <DownloadGlyph t={t} phase={phase} progress={progress} />
          </Tool>
        ) : null}
        <Tool label="Add to playlist" onPress={onPlaylist}>
          <SpIcon name="listPlus" size={25} color={t.ink800} />
        </Tool>
        <Tool label="Share" onPress={onShare}>
          <PlayerIcon name="share" size={24} color={t.ink800} />
        </Tool>
        <Tool label="More" onPress={onMore}>
          <PlayerIcon name="more" size={24} color={t.ink800} />
        </Tool>
      </View>
      <SpPress
        onPress={onPlay}
        accessibilityLabel={playing ? "Pause" : "Play"}
        pressedScale={0.94}
        style={[styles.play, { backgroundColor: accent.fill }]}
      >
        <SpIcon name={playing ? "pause" : "play"} size={30} color={accent.onFill} />
      </SpPress>
    </View>
  )
}

const styles = StyleSheet.create({
  washBox: { position: "absolute", left: 0, right: 0, top: -700, height: SP_WASH_HEIGHT + 700 },
  coverBox: { alignSelf: "center" },
  glow: { position: "absolute", left: 0, top: 18, opacity: 0.6, transform: [{ scale: 1.08 }] },
  text: { paddingHorizontal: 20, paddingTop: SP_HERO_TEXT_TOP, gap: 4 },
  h1: {
    fontFamily: amFonts.display,
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: -0.6,
    textTransform: "uppercase",
  },
  line: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20, marginTop: 6 },
  perfHit: { alignSelf: "flex-start", minHeight: 28, justifyContent: "center" },
  performer: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  metaHit: { alignSelf: "flex-start", minHeight: 24, justifyContent: "center" },
  meta: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 10, paddingRight: 20, paddingTop: SP_PLAY_TOP },
  tools: { flexDirection: "row", alignItems: "center" },
  tool: { width: 46, height: 48, alignItems: "center", justifyContent: "center" },
  play: { width: SP_PLAY_SIZE, height: SP_PLAY_SIZE, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  ring: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  pct: { fontFamily: amFonts.bold, fontSize: 10, lineHeight: 12, fontVariant: ["tabular-nums"] },
  savedDot: { width: 26, height: 26, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
})
