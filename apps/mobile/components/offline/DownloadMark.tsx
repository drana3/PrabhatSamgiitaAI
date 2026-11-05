import { useEffect, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import Svg, { Circle, Path } from "react-native-svg"

import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { clampRatio, type DownloadStatus } from "@/lib/offline/downloadModel"

type Props = {
  status: DownloadStatus
  /** 0 to 1, read while downloading */
  progress?: number
  size?: number
  /** the arrow, and the number inside the ring */
  color?: string
  /** the empty part of the ring */
  track?: string
  /** the running part of the ring (progress colour: orange500) */
  ring?: string
  /** the disc of the done check (action fill: orange700) */
  fill?: string
  /** the check on the disc */
  onFill?: string
}

const REDUCED_MS = 120
const ARROW = "M12 4v11M7 11l5 5 5-5M5 20h14"
const CHECK = "M7.5 12.5l3.3 3.3 5.7-6.6"

/**
 * The mark of the one download control: an arrow while idle, a progress ring with the percent
 * inside while downloading, an orange check disc when done. The three layers cross-fade on a
 * critically damped spring and the check pops in from 0.82 without overshoot (a short fade with
 * Reduce Motion). Only opacity and transform animate; the ring itself follows the progress it is given.
 */
export function DownloadMark({ status, progress = 0, size = 24, color, track, ring, fill, onFill }: Props) {
  const theme = useAmTheme()
  const reduce = useReducedMotion()
  const ink = color ?? theme.textHeading
  const trackColor = track ?? theme.line
  const ringColor = ring ?? theme.accentBright
  const disc = fill ?? theme.brand
  const check = onFill ?? theme.onBrand

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

  const ringSize = Math.round(size * 1.18)
  const stroke = Math.max(2, size / 10)
  const radius = (ringSize - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = Math.max(0.04, clampRatio(progress))
  const percent = Math.round(clampRatio(progress) * 100)

  return (
    <View aria-hidden pointerEvents="none" style={{ width: size, height: size }}>
      <Animated.View style={[styles.layer, idleStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d={ARROW} stroke={ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, runStyle]}>
        <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <Circle cx={ringSize / 2} cy={ringSize / 2} r={radius} stroke={trackColor} strokeWidth={stroke} fill="none" />
          <Circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - ratio)}
            transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
          />
        </Svg>
        <Text style={[styles.pct, { color: ink, fontSize: Math.max(9, Math.round(size * 0.36)) }]}>{percent}</Text>
      </Animated.View>
      <Animated.View style={[styles.layer, doneStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={11} fill={disc} />
          <Path d={CHECK} stroke={check} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  pct: { position: "absolute", fontFamily: amFonts.bold, fontVariant: ["tabular-nums"], textAlign: "center" },
})
