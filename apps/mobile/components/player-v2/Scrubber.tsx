import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated"

import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { amFonts } from "@/constants/tokens/amTypography"
import { scrubRatio, secondsFromRatio } from "@/lib/playerV2/gesture"
import { formatClock } from "@/lib/playerV2/transportState"
import { waveformHeights } from "@/lib/playerV2/waveform"

type Props = {
  position: number
  /** Null until the file or API reports it; the bar is then inert and shows no total. */
  duration: number | null
  /** Song number: seeds the bar heights, so every song has its own shape. */
  songNumber: number
  onSeek: (seconds: number) => void
}

/** A finger within this distance of the head grabs it instead of jumping. */
const GRAB_RADIUS = 22

/**
 * Seek logic shared by the waveform and the thick bar. The head answers on
 * touch-down, follows the finger 1:1 from where it was grabbed, and the seek is
 * sent on release, so the audio never stutters under a moving finger.
 */
function useScrub({ position, duration, onSeek }: Pick<Props, "position" | "duration" | "onSeek">) {
  const width = useSharedValue(0)
  const playRatio = useSharedValue(0)
  const dragRatio = useSharedValue(0)
  const dragging = useSharedValue(0)
  const grabX = useSharedValue(0)
  const startRatio = useSharedValue(0)
  const [scrubSeconds, setScrubSeconds] = useState<number | null>(null)

  const known = duration != null && duration > 1
  const total = known ? duration : 0

  useEffect(() => {
    playRatio.value = known ? Math.min(1, Math.max(0, position / total)) : 0
  }, [position, total, known, playRatio])

  useAnimatedReaction(
    () => (dragging.value ? Math.floor(secondsFromRatio(dragRatio.value, total)) : -1),
    (seconds, previous) => {
      if (seconds !== previous) runOnJS(setScrubSeconds)(seconds < 0 ? null : seconds)
    },
  )

  const gesture = Gesture.Pan()
    .enabled(known)
    .minDistance(0)
    .onBegin((event) => {
      dragging.value = 1
      grabX.value = event.x
      startRatio.value = playRatio.value
      dragRatio.value = scrubRatio({
        touchDownX: event.x,
        touchX: event.x,
        width: width.value,
        startRatio: playRatio.value,
        thumbRadius: GRAB_RADIUS,
      })
    })
    .onUpdate((event) => {
      dragRatio.value = scrubRatio({
        touchDownX: grabX.value,
        touchX: event.x,
        width: width.value,
        startRatio: startRatio.value,
        thumbRadius: GRAB_RADIUS,
      })
    })
    .onFinalize(() => {
      // A tap with no movement ends the pan as "failed"; it still means "go here".
      if (dragging.value) {
        runOnJS(onSeek)(secondsFromRatio(dragRatio.value, total))
        playRatio.value = dragRatio.value
        dragging.value = 0
      }
    })

  /** The ratio on screen: the finger while it is down, the song otherwise. */
  const shown = useSharedValue(0)
  useAnimatedReaction(
    () => (dragging.value ? dragRatio.value : playRatio.value),
    (ratio) => {
      shown.value = ratio
    },
  )

  const accessibility = {
    accessible: true,
    accessibilityRole: "adjustable" as const,
    accessibilityLabel: "Position",
    accessibilityValue: known ? { min: 0, max: Math.floor(total), now: Math.floor(position) } : undefined,
    accessibilityActions: [{ name: "increment" }, { name: "decrement" }],
    onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => {
      if (!known) return
      const step = e.nativeEvent.actionName === "increment" ? 10 : -10
      onSeek(Math.min(total, Math.max(0, position + step)))
    },
  }

  return { gesture, width, shown, known, total, elapsed: scrubSeconds ?? position, accessibility }
}

function Times({ elapsed, total, known }: { elapsed: number; total: number; known: boolean }) {
  return (
    <View style={styles.times}>
      <Text style={styles.time}>{formatClock(elapsed)}</Text>
      <Text style={styles.time}>{known ? formatClock(total) : ""}</Text>
    </View>
  )
}

/** The seek bar of the Player: 56 bars, the played ones solid, a gold head (prototype .wave). */
export function Waveform(props: Props) {
  const { gesture, width, shown, known, total, elapsed, accessibility } = useScrub(props)
  const heights = useMemo(() => waveformHeights(props.songNumber, playerSize.waveBars), [props.songNumber])

  const head = useAnimatedStyle(() => ({ transform: [{ translateX: shown.value * width.value }] }))

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.wave}
          onLayout={(e) => {
            width.value = e.nativeEvent.layout.width
          }}
          {...accessibility}
        >
          {heights.map((h, i) => (
            <WaveBar key={i} index={i} count={heights.length} height={h} shown={shown} />
          ))}
          <Animated.View pointerEvents="none" style={[styles.head, head]} />
        </View>
      </GestureDetector>
      <Times elapsed={elapsed} total={total} known={known} />
    </View>
  )
}

function WaveBar({ index, count, height, shown }: { index: number; count: number; height: number; shown: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: index / count < shown.value ? 1 : 0.32 }))
  return <Animated.View style={[styles.bar, { height: `${height}%` }, style]} />
}

/** Drive mode seek bar: 8px track in the sun colour, 44px to grab (prototype .thick). */
export function ThickScrubber(props: Omit<Props, "songNumber">) {
  const { gesture, width, shown, known, total, elapsed, accessibility } = useScrub(props)
  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: (shown.value - 1) * width.value }] }))

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.thick}
          onLayout={(e) => {
            width.value = e.nativeEvent.layout.width
          }}
          {...accessibility}
        >
          <View style={styles.thickTrack}>
            <Animated.View style={[styles.thickFill, fill]} />
          </View>
        </View>
      </GestureDetector>
      <Times elapsed={elapsed} total={total} known={known} />
    </View>
  )
}

const styles = StyleSheet.create({
  wave: {
    height: playerSize.waveHeight,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: playerSize.waveGap,
  },
  bar: { flex: 1, minWidth: 0, borderRadius: 2, backgroundColor: "#FFFFFF" },
  head: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: playerSize.waveHead,
    borderRadius: 2,
    backgroundColor: playerColors.sun,
  },
  thick: { height: playerSize.thickHit, marginHorizontal: 20, justifyContent: "center" },
  thickTrack: {
    height: playerSize.thickTrack,
    borderRadius: 9999,
    backgroundColor: playerColors.thickTrack,
    overflow: "hidden",
  },
  thickFill: { ...StyleSheet.absoluteFillObject, borderRadius: 9999, backgroundColor: playerColors.sun },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, marginHorizontal: 20 },
  time: { fontFamily: amFonts.medium, fontSize: 13, color: playerColors.textSoft, fontVariant: ["tabular-nums"] },
})
