import { useEffect, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import Svg, { Circle, Path } from "react-native-svg"

import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { DOWNLOAD_ARROW_PATH, DOWNLOADED_EDGE_ON_DARK, DOWNLOADED_FILL, DOWNLOADED_GLYPH, DOWNLOADED_GLYPH_COLOR } from "@/lib/offline/downloadLook"
import { clampRatio, type DownloadStatus } from "@/lib/offline/downloadModel"

type Props = {
  status: DownloadStatus
  /** 0 to 1, read while downloading */
  progress?: number
  size?: number
  /** the outline circle, the arrow and the number inside the ring (idle and downloading) */
  color?: string
  /** the empty part of the ring */
  track?: string
  /** the running part of the ring (progress colour: orange500) */
  ring?: string
  /** true on a dark ground (the full player, Dark theme): the done disc gets a light edge so it still reads */
  onDark?: boolean
}

const REDUCED_MS = 120
const ARROW = DOWNLOAD_ARROW_PATH
/**
 * The mark of the one download control. It is built on an arrow inside a circle OUTLINE so it can
 * never be taken for the save mark (a circle-plus that becomes a filled ORANGE circle-check):
 *   idle         grey outline circle with an arrow-down
 *   downloading  the same circle as a progress ring (orange500 over the track) with the percent inside
 *   done         solid forest-green (sage700) disc with a white arrow-down-to-tray glyph, no check
 * The layers cross-fade on a critically damped spring and the done disc pops in from 0.82 without
 * overshoot (a short fade with Reduce Motion). Only opacity and transform animate; the ring follows
 * the progress it is given.
 */
export function DownloadMark({ status, progress = 0, size = 24, color, track, ring, onDark }: Props) {
  const theme = useAmTheme()
  const dark = useResolvedAppearance() === "dark"
  const reduce = useReducedMotion()
  const ink = color ?? theme.textHeading
  const trackColor = track ?? theme.line
  const ringColor = ring ?? theme.accentBright
  const edge = (onDark ?? dark) ? DOWNLOADED_EDGE_ON_DARK : null

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

  // every state is drawn on the same 24 x 24 box with the same circle (r 9.25), so nothing jumps
  const circumference = 2 * Math.PI * 9.25
  const ratio = Math.max(0.04, clampRatio(progress))
  const percent = Math.round(clampRatio(progress) * 100)

  return (
    <View aria-hidden pointerEvents="none" style={{ width: size, height: size }}>
      <Animated.View style={[styles.layer, idleStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9.25} stroke={ink} strokeWidth={1.75} />
          <Path d={ARROW} stroke={ink} strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, runStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9.25} stroke={trackColor} strokeWidth={2.25} />
          <Circle
            cx={12}
            cy={12}
            r={9.25}
            stroke={ringColor}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - ratio)}
            transform="rotate(-90 12 12)"
          />
        </Svg>
        <Text style={[styles.pct, { color: ink, fontSize: Math.max(8, Math.round(size * 0.34)) }]}>{percent}</Text>
      </Animated.View>
      <Animated.View style={[styles.layer, doneStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={edge ? 10.4 : 11} fill={DOWNLOADED_FILL} stroke={edge ?? undefined} strokeWidth={edge ? 1.2 : 0} />
          <Path d={DOWNLOADED_GLYPH} stroke={DOWNLOADED_GLYPH_COLOR} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  pct: { position: "absolute", fontFamily: amFonts.bold, fontVariant: ["tabular-nums"], textAlign: "center" },
})
