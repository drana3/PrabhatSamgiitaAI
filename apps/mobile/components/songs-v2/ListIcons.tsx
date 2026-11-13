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

import { DOWNLOAD_ARROW_PATH, DOWNLOAD_SQUARE_LENGTH, DOWNLOAD_SQUARE_PATH, DOWNLOADED_GLYPH } from "@/lib/offline/downloadLook"
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

/**
 * Download of a list or a song, drawn like components/offline/DownloadMark (look: lib/offline/downloadLook.ts).
 * idle: rounded-square outline and arrow. downloading: the outline's first quarter runs in the progress colour
 * and the arrow breathes. done: a solid square with the arrow-down-to-tray glyph.
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
  /** square outline and arrow while idle or running */
  color: string
  /** square when done */
  fill: string
  /** arrow on the square */
  onFill: string
}) {
  const reduce = useReducedMotion()
  const breathe = useSharedValue(1)
  useEffect(() => {
    if (state === "downloading" && !reduce) {
      breathe.value = withRepeat(withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true)
    } else {
      cancelAnimation(breathe)
      breathe.value = 1
    }
    return () => cancelAnimation(breathe)
  }, [state, reduce, breathe])
  const pulse = useAnimatedStyle(() => ({ opacity: breathe.value }))

  if (state === "done") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x={2.4} y={2.4} width={19.2} height={19.2} rx={5.6} fill={fill} />
        <Path d={DOWNLOADED_GLYPH} stroke={onFill} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    )
  }
  if (state === "downloading") {
    return (
      <Animated.View style={[{ width: size, height: size }, pulse]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d={DOWNLOAD_SQUARE_PATH} stroke={color} strokeWidth={2.25} strokeLinejoin="round" opacity={0.28} />
          <Path d={DOWNLOAD_SQUARE_PATH} stroke={fill} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${DOWNLOAD_SQUARE_LENGTH / 4} ${DOWNLOAD_SQUARE_LENGTH}`} />
          <Path d={DOWNLOAD_ARROW_PATH} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    )
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={DOWNLOAD_SQUARE_PATH} stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
      <Path d={DOWNLOAD_ARROW_PATH} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
