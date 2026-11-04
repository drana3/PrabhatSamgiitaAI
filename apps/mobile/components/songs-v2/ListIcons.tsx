import { useEffect } from "react"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import Svg, { Circle, Path, Rect } from "react-native-svg"

import type { DownloadAllState } from "@/lib/songsV2/listPage"

/**
 * Icons of the playlist-style pages, drawn like the rest of the Songs area (24 x 24 viewBox, round
 * caps, stroke 1.75) so they sit next to the prototype glyphs.
 */
type G = { size?: number; color: string; strokeWidth?: number }

function Stroke({ d, size = 24, color, strokeWidth = 1.75 }: G & { d: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export const ShuffleIcon = (p: G) => (
  <Stroke {...p} d="M16 4h5v5M4 20 21 4M21 15v5h-5M15 15l6 5M4 4l5 5" />
)

export function DotsIcon({ size = 24, color }: G) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={5} cy={12} r={1.7} fill={color} />
      <Circle cx={12} cy={12} r={1.7} fill={color} />
      <Circle cx={19} cy={12} r={1.7} fill={color} />
    </Svg>
  )
}

export function PauseIcon({ size = 24, color }: G) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={6.5} y={5} width={4} height={14} rx={1.2} fill={color} />
      <Rect x={13.5} y={5} width={4} height={14} rx={1.2} fill={color} />
    </Svg>
  )
}

/** Arrow with a rounded foot, shared by every download state. */
const ARROW = "M12 7.5v8M8.5 12.2l3.5 3.5 3.5-3.5"

/**
 * Download of a list or a song. idle: ring and arrow. downloading: the ring turns. done: a filled
 * disc with a dark arrow (the "down-arrow in a circle" of a downloaded row).
 */
export function DownloadIcon({
  state,
  size = 24,
  color,
  fill,
  onFill,
}: {
  state: DownloadAllState
  size?: number
  /** ring and arrow while idle or running */
  color: string
  /** disc when done */
  fill: string
  /** arrow on the disc */
  onFill: string
}) {
  const reduce = useReducedMotion()
  const turn = useSharedValue(0)
  useEffect(() => {
    if (state === "downloading" && !reduce) {
      turn.value = 0
      turn.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1, false)
    } else {
      cancelAnimation(turn)
      turn.value = 0
    }
    return () => cancelAnimation(turn)
  }, [state, reduce, turn])
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))

  if (state === "done") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9.5} fill={fill} />
        <Path d={ARROW} stroke={onFill} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    )
  }
  if (state === "downloading") {
    return (
      <Animated.View style={[{ width: size, height: size }, spin]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9.25} stroke={color} strokeWidth={1.75} opacity={0.28} />
          <Path d="M12 2.75a9.25 9.25 0 0 1 9.25 9.25" stroke={fill} strokeWidth={2.25} strokeLinecap="round" />
          <Path d={ARROW} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    )
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9.25} stroke={color} strokeWidth={1.75} />
      <Path d={ARROW} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
