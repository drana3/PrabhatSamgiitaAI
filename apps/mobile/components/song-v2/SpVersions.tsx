import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Image as ExpoImage } from "expo-image"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { coverFor } from "@/components/player-v2/playerCovers"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { songAccents } from "@/lib/songPage/accent"
import { versionDetail, type SongVersion } from "@/lib/songPage/versions"

import { SpIcon } from "./SpIcon"
import { SpPress } from "./SpUi"

const BAR_H = 14
/** Resting scale of each bar when nothing moves (paused or reduced motion). */
const STATIC = [0.55, 1, 0.75] as const
const LOOP = [
  { low: 0.3, high: 1, ms: 420 },
  { low: 0.4, high: 0.85, ms: 560 },
  { low: 0.25, high: 0.95, ms: 480 },
] as const

function Bar({ color, index, moving }: { color: string; index: number; moving: boolean }) {
  const reduce = useReducedMotion()
  const scale = useSharedValue<number>(STATIC[index]!)
  useEffect(() => {
    const spec = LOOP[index]!
    if (moving && !reduce) {
      scale.value = withDelay(
        index * 90,
        withRepeat(
          withSequence(
            withTiming(spec.high, { duration: spec.ms, easing: Easing.inOut(Easing.quad) }),
            withTiming(spec.low, { duration: spec.ms, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
        ),
      )
    } else {
      cancelAnimation(scale)
      scale.value = withTiming(STATIC[index]!, { duration: 150 })
    }
    return () => cancelAnimation(scale)
  }, [moving, reduce, index, scale])
  // grow from the baseline: scale around the centre, then drop by the half that was added or lost
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ((1 - scale.value) * BAR_H) / 2 }, { scaleY: scale.value }],
  }))
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
}

/** The "now playing" glyph of the playing row: three bars that move while it plays, still when it is paused or under reduced motion. */
export function SpEqualizer({ color, moving }: { color: string; moving: boolean }) {
  return (
    <View style={styles.eq} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Bar color={color} index={0} moving={moving} />
      <Bar color={color} index={1} moving={moving} />
      <Bar color={color} index={2} moving={moving} />
    </View>
  )
}

/**
 * One row of "Versions" (Spotify's other versions): a small cover, the performer, `Voice · 3:58 · Best`, a play
 * affordance and the three dots. The version that is loaded in the player shows orange with the equalizer.
 */
export function SpVersionRow({
  t,
  songNumber,
  version,
  current,
  playing,
  onPlay,
  onMore,
}: {
  t: SpTheme
  songNumber: number
  version: SongVersion
  /** The player has this version loaded. */
  current: boolean
  /** ... and it is playing. */
  playing: boolean
  onPlay: () => void
  onMore: () => void
}) {
  const cover = coverFor(songNumber)
  const accent = songAccents(t)
  return (
    <View style={styles.row}>
      <SpPress
        onPress={onPlay}
        pressedScale={0.985}
        accessibilityLabel={`${version.performer}, ${versionDetail(version)}${current ? (playing ? ", playing" : ", paused") : ""}`}
        accessibilityState={{ selected: current }}
        style={styles.main}
      >
        <ExpoImage
          source={cover.source}
          contentFit="cover"
          contentPosition={cover.position}
          style={[styles.cover, { backgroundColor: t.sand400 }]}
        />
        <View style={styles.texts}>
          <View style={styles.nameRow}>
            {current ? <SpEqualizer color={accent.bright} moving={playing} /> : null}
            <Text style={[styles.name, { color: current ? accent.text : t.ink900 }]} numberOfLines={1}>
              {version.performer}
            </Text>
          </View>
          <Text style={[styles.detail, { color: t.ink500, fontVariant: ["tabular-nums"] }]} numberOfLines={1}>
            {versionDetail(version)}
          </Text>
        </View>
      </SpPress>
      <SpPress
        onPress={onPlay}
        accessibilityLabel={playing ? "Pause this version" : "Play this version"}
        pressedScale={0.88}
        style={[
          styles.playBtn,
          { borderColor: playing ? accent.fill : accent.bright, backgroundColor: playing ? accent.fill : "transparent" },
        ]}
      >
        <SpIcon name={playing ? "pause" : "play"} size={16} color={playing ? accent.onFill : accent.bright} />
      </SpPress>
      <SpPress onPress={onMore} accessibilityLabel={`More about ${version.performer}'s version`} pressedScale={0.88} style={styles.more}>
        <PlayerIcon name="more" size={22} color={t.ink800} />
      </SpPress>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 64, paddingLeft: 20, paddingRight: 6, paddingVertical: 6 },
  main: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  cover: { width: 52, height: 52, borderRadius: 10 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1, fontFamily: amFonts.bold, fontSize: 16, lineHeight: 21 },
  detail: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  playBtn: { width: 38, height: 38, borderRadius: 9999, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  more: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  eq: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: BAR_H, width: 14 },
  bar: { width: 3, height: BAR_H, borderRadius: 1.5 },
})
