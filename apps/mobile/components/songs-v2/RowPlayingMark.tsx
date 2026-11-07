import { memo, useEffect } from "react"
import { StyleSheet, View } from "react-native"
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

import { usePlayerStore } from "@/stores/playerStore"

const HEIGHT = 14

/**
 * The small equaliser that takes the place of a row's number while its song is the one in the player:
 * three bars that move while it plays and rest low when it is paused. Reduce Motion: still bars at
 * half height. Only transform animates; only the playing row ever mounts this.
 */
export const RowPlayingMark = memo(function RowPlayingMark({ color }: { color: string }) {
  const playing = usePlayerStore((s) => s.isPlaying)
  return (
    <View style={styles.box} aria-hidden>
      <Bar delay={0} playing={playing} color={color} />
      <Bar delay={160} playing={playing} color={color} />
      <Bar delay={320} playing={playing} color={color} />
    </View>
  )
})

function Bar({ delay, playing, color }: { delay: number; playing: boolean; color: string }) {
  const reduce = useReducedMotion()
  const scale = useSharedValue(0.35)
  useEffect(() => {
    cancelAnimation(scale)
    if (reduce) {
      scale.value = 0.55
      return
    }
    if (!playing) {
      scale.value = withTiming(0.35, { duration: 200 })
      return
    }
    const ease = Easing.inOut(Easing.ease)
    scale.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 420, easing: ease }), withTiming(0.25, { duration: 420, easing: ease })), -1),
    )
  }, [playing, reduce, delay, scale])
  // transform-origin is the centre, so shift by half the lost height to pin the bar to the bottom
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: ((1 - scale.value) * HEIGHT) / 2 }, { scaleY: scale.value }] }))
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: HEIGHT, width: 14 },
  bar: { width: 3, height: HEIGHT, borderRadius: 1.5 },
})
