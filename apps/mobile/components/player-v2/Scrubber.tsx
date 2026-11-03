import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"

import { amSpring } from "@/constants/tokens/amMotion"
import { amFontSize, amFonts, amType } from "@/constants/tokens/amTypography"
import { amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { scrubRatio, secondsFromRatio } from "@/lib/playerV2/gesture"
import { formatClock, formatRemaining } from "@/lib/playerV2/transportState"
import { playerColors, playerSize } from "@/components/player-v2/playerTokens"

type Props = {
  position: number
  /** Null until the file or API reports it; the bar is then inert and shows no total. */
  duration: number | null
  onSeek: (seconds: number) => void
}

/**
 * Seek bar. The thumb answers on touch-down (it grows), follows the finger
 * 1:1 from where it was grabbed, and springs back to size on release.
 * Fill and thumb move with transforms only.
 */
export function Scrubber({ position, duration, onSeek }: Props) {
  const reduce = useReducedMotion()
  const width = useSharedValue(0)
  const playRatio = useSharedValue(0)
  const dragRatio = useSharedValue(0)
  const dragging = useSharedValue(0)
  const grabX = useSharedValue(0)
  const startRatio = useSharedValue(0)
  const thumbScale = useSharedValue(1)
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

  const pan = Gesture.Pan()
    .enabled(known)
    .minDistance(0)
    .onBegin((event) => {
      // Touch-down: feedback first, seek on release.
      dragging.value = 1
      grabX.value = event.x
      startRatio.value = playRatio.value
      dragRatio.value = scrubRatio({
        touchDownX: event.x,
        touchX: event.x,
        width: width.value,
        startRatio: playRatio.value,
        thumbRadius: amTouchTarget / 2,
      })
      thumbScale.value = withSpring(playerSize.thumbPressed / playerSize.thumb, amSpring.default)
    })
    .onUpdate((event) => {
      dragRatio.value = scrubRatio({
        touchDownX: grabX.value,
        touchX: event.x,
        width: width.value,
        startRatio: startRatio.value,
        thumbRadius: amTouchTarget / 2,
      })
    })
    .onFinalize(() => {
      // A tap with no movement ends the pan as "failed"; it still means "go here".
      if (dragging.value) {
        runOnJS(onSeek)(secondsFromRatio(dragRatio.value, total))
        playRatio.value = dragRatio.value
        dragging.value = 0
      }
      thumbScale.value = withSpring(1, amSpring.default)
    })

  const shown = () => {
    "worklet"
    return dragging.value ? dragRatio.value : playRatio.value
  }

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (shown() - 1) * width.value }],
  }))
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shown() * width.value - playerSize.thumb / 2 },
      { scale: reduce ? 1 : thumbScale.value },
    ],
  }))

  const elapsed = scrubSeconds ?? position

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={pan}>
        <View
          style={styles.hit}
          onLayout={(e) => {
            width.value = e.nativeEvent.layout.width
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Seek"
          accessibilityValue={known ? { min: 0, max: Math.floor(total), now: Math.floor(position) } : undefined}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            if (!known) return
            const step = e.nativeEvent.actionName === "increment" ? 10 : -10
            onSeek(Math.min(total, Math.max(0, position + step)))
          }}
        >
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
          {known ? <Animated.View style={[styles.thumb, thumbStyle]} /> : null}
        </View>
      </GestureDetector>
      <View style={styles.times}>
        <Text style={styles.time}>{formatClock(elapsed)}</Text>
        <Text style={styles.time}>{known ? formatRemaining(elapsed, total) : ""}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  hit: { height: amTouchTarget, justifyContent: "center" },
  track: {
    height: playerSize.trackHeight,
    borderRadius: playerSize.trackHeight / 2,
    backgroundColor: playerColors.trackBase,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: playerColors.brand,
  },
  thumb: {
    position: "absolute",
    left: 0,
    width: playerSize.thumb,
    height: playerSize.thumb,
    borderRadius: playerSize.thumb / 2,
    backgroundColor: playerColors.text,
  },
  times: { flexDirection: "row", justifyContent: "space-between", paddingBottom: amSpace.s1 },
  time: {
    ...amType.body,
    fontFamily: amFonts.medium,
    fontSize: amFontSize.label,
    lineHeight: 16,
    color: playerColors.textSoft,
    fontVariant: ["tabular-nums"],
  },
})
