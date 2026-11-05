import { useEffect, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import Svg, { Path, Rect } from "react-native-svg"

import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { DOWNLOAD_ARROW_PATH, DOWNLOAD_SQUARE_LENGTH, DOWNLOAD_SQUARE_PATH, DOWNLOADED_GLYPH, downloadColors } from "@/lib/offline/downloadLook"
import { clampRatio, type DownloadStatus } from "@/lib/offline/downloadModel"

type Props = {
  status: DownloadStatus
  /** 0 to 1, read while downloading */
  progress?: number
  size?: number
  /** the square outline, the arrow and the number inside (idle and downloading) */
  color?: string
  /** true on a dark ground (the full player, Dark theme): the done square and the running outline take their dark colours */
  onDark?: boolean
}

const REDUCED_MS = 120
const ARROW = DOWNLOAD_ARROW_PATH
/**
 * The mark of the one download control: a rounded SQUARE with an arrow, so it can never be taken for the
 * save mark (a CIRCLE-plus that becomes a filled ORANGE circle-check). Look and colours: lib/offline/downloadLook.ts.
 *   idle         square outline with an arrow-down
 *   downloading  the outline fills clockwise from the top (orange over the track), percent inside
 *   done         solid green square with a white arrow-down-to-tray, no check
 * The layers cross-fade on a critically damped spring and the done square pops in from 0.82 without
 * overshoot (a short fade with Reduce Motion). Only opacity and transform animate; the outline follows
 * the progress it is given.
 */
export function DownloadMark({ status, progress = 0, size = 24, color, onDark }: Props) {
  const theme = useAmTheme()
  const dark = useResolvedAppearance() === "dark"
  const reduce = useReducedMotion()
  const ink = color ?? theme.textHeading
  const look = downloadColors(onDark ?? dark)
  const trackColor = look.track

  const idle = useSharedValue(status === "idle" ? 1 : 0)
  const run = useSharedValue(status === "downloading" ? 1 : 0)
  const done = useSharedValue(status === "done" ? 1 : 0)
  const pop = useSharedValue(1)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const to = (value: number) => (reduce ? withTiming(value, { duration: REDUCED_MS }) : withSpring(value, amSpring.default))
    idle.value = to(status === "idle" ? 1 : 0)
    run.value = to(status === "downloading" ? 1 : 0)
    done.value = to(status === "done" ? 1 : 0)
    if (status === "done" && !reduce) {
      pop.value = 0.82
      pop.value = withSpring(1, amSpring.default)
    }
  }, [status, reduce, idle, run, done, pop])

  const idleStyle = useAnimatedStyle(() => ({ opacity: idle.value }))
  const runStyle = useAnimatedStyle(() => ({ opacity: run.value }))
  const doneStyle = useAnimatedStyle(() => ({ opacity: done.value, transform: [{ scale: pop.value }] }))

  // every state is drawn on the same 24 x 24 box with the same square, so nothing jumps
  const ratio = Math.max(0.04, clampRatio(progress))
  const percent = Math.round(clampRatio(progress) * 100)

  return (
    <View aria-hidden pointerEvents="none" style={{ width: size, height: size }}>
      <Animated.View style={[styles.layer, idleStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d={DOWNLOAD_SQUARE_PATH} stroke={ink} strokeWidth={1.75} strokeLinejoin="round" />
          <Path d={DOWNLOAD_ARROW_PATH} stroke={ink} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, runStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d={DOWNLOAD_SQUARE_PATH} stroke={trackColor} strokeWidth={2.25} strokeLinejoin="round" />
          <Path
            d={DOWNLOAD_SQUARE_PATH}
            stroke={look.progress}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${ratio * DOWNLOAD_SQUARE_LENGTH} ${DOWNLOAD_SQUARE_LENGTH}`}
          />
        </Svg>
        <Text style={[styles.pct, { color: ink, fontSize: Math.max(8, Math.round(size * 0.34)) }]}>{percent}</Text>
      </Animated.View>
      <Animated.View style={[styles.layer, doneStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x={2.4} y={2.4} width={19.2} height={19.2} rx={5.6} fill={look.fill} />
          <Path d={DOWNLOADED_GLYPH} stroke={look.glyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  pct: { position: "absolute", fontFamily: amFonts.bold, fontVariant: ["tabular-nums"], textAlign: "center" },
})
