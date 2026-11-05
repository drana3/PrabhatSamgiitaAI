import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"

import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { amFonts } from "@/constants/tokens/amTypography"
import { scrubRatio, secondsFromRatio, shouldSeekOnRelease } from "@/lib/playerV2/gesture"
import { formatClock } from "@/lib/playerV2/transportState"
import { amSpring } from "@/constants/tokens/amMotion"
import { useT } from "@/lib/i18n"

type Props = {
  position: number
  /** Null until the file or API reports it; the bar is then inert and shows no total. */
  duration: number | null
  onSeek: (seconds: number) => void
}

/** A finger within this distance of the head grabs it instead of jumping. */
const GRAB_RADIUS = 22

/**
 * Seek logic shared by the thin line and the thick bar. The head answers on
 * touch-down, follows the finger 1:1 from where it was grabbed, and the seek is
 * sent on release, so the audio never stutters under a moving finger.
 */
function useScrub({ position, duration, onSeek }: Pick<Props, "position" | "duration" | "onSeek">) {
  const t = useT()
  const width = useSharedValue(0)
  const playRatio = useSharedValue(0)
  const dragRatio = useSharedValue(0)
  const dragging = useSharedValue(0)
  const grabX = useSharedValue(0)
  const startRatio = useSharedValue(0)
  const activated = useSharedValue(0)
  const touchesCancelled = useSharedValue(0)
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
      activated.value = 0
      touchesCancelled.value = 0
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
    .onStart(() => {
      activated.value = 1
    })
    .onTouchesCancelled(() => {
      touchesCancelled.value = 1
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
    .onFinalize((_event, success) => {
      // A tap with no movement ends the pan as "failed"; it still means "go here". A gesture that was
      // cancelled (the player swiped closed, a call) leaves the song where it was.
      if (dragging.value) {
        if (shouldSeekOnRelease({ activated: activated.value === 1, success, touchesCancelled: touchesCancelled.value === 1 })) {
          runOnJS(onSeek)(secondsFromRatio(dragRatio.value, total))
          playRatio.value = dragRatio.value
        }
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
    accessibilityLabel: t("player.position"),
    accessibilityValue: known ? { min: 0, max: Math.floor(total), now: Math.floor(position) } : undefined,
    accessibilityActions: [{ name: "increment" }, { name: "decrement" }],
    onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => {
      if (!known) return
      const step = e.nativeEvent.actionName === "increment" ? 10 : -10
      onSeek(Math.min(total, Math.max(0, position + step)))
    },
  }

  return { gesture, width, shown, dragging, known, total, elapsed: scrubSeconds ?? position, accessibility }
}

function Times({ elapsed, total, known }: { elapsed: number; total: number; known: boolean }) {
  return (
    <View style={styles.times}>
      <Text style={styles.time}>{formatClock(elapsed)}</Text>
      <Text style={styles.time}>{known ? formatClock(total) : ""}</Text>
    </View>
  )
}

/**
 * The seek bar of the Player: a 3px line, the played part in the accent orange, a 10px dot at the
 * position that grows to 14px while a finger holds it, the times under it. The touch area is 32px
 * tall. It answers on touch-down and follows the finger 1:1 from where it was grabbed.
 */
export function ThinScrubber(props: Props) {
  const { gesture, width, shown, dragging, known, total, elapsed, accessibility } = useScrub(props)
  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: (shown.value - 1) * width.value }] }))
  // The dot grows by a spring that starts from the size on screen, so a quick tap never jumps.
  const grow = useSharedValue(1)
  useAnimatedReaction(
    () => dragging.value,
    (down) => {
      grow.value = withSpring(down ? playerSize.thinDotGrown / playerSize.thinDot : 1, amSpring.default)
    },
  )
  const dot = useAnimatedStyle(() => ({
    transform: [{ translateX: shown.value * width.value - playerSize.thinDot / 2 }, { scale: grow.value }],
  }))

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.thin}
          onLayout={(e) => {
            width.value = e.nativeEvent.layout.width
          }}
          {...accessibility}
        >
          <View style={styles.thinTrack}>
            <Animated.View style={[styles.thinFill, fill]} />
          </View>
          <Animated.View pointerEvents="none" style={[styles.thinDot, dot]} />
        </View>
      </GestureDetector>
      <Times elapsed={elapsed} total={total} known={known} />
    </View>
  )
}

/** Drive mode seek bar: 8px track in the sun colour, 44px to grab (prototype .thick). */
export function ThickScrubber(props: Props) {
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
  thin: { height: playerSize.thinHit, marginHorizontal: 20, justifyContent: "center" },
  thinTrack: { height: playerSize.thinTrack, borderRadius: 9999, backgroundColor: playerColors.thickTrack, overflow: "hidden" },
  thinFill: { ...StyleSheet.absoluteFillObject, borderRadius: 9999, backgroundColor: playerColors.brand },
  thinDot: {
    position: "absolute",
    left: 0,
    top: (playerSize.thinHit - playerSize.thinDot) / 2,
    width: playerSize.thinDot,
    height: playerSize.thinDot,
    borderRadius: 9999,
    backgroundColor: playerColors.brand,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
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
  time: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18.85, color: playerColors.textSoft, fontVariant: ["tabular-nums"] },
})
