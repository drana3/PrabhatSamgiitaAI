import { useEffect, useRef } from "react"
import { StyleSheet } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import Svg, { Circle, Path } from "react-native-svg"

import { amSpring } from "@/constants/tokens/amMotion"
import { useAmTheme } from "@/hooks/useAmTheme"

type Props = {
  on: boolean
  size: number
  /** `plus`: empty state is a circle with a plus (the button). `ring`: an empty ring (a radio in the sheet). */
  empty?: "plus" | "ring"
  /** Colour of the empty circle and its plus. */
  color?: string
  /** Fill of the saved circle. Defaults to the theme's action fill (orange700); the check on it is white. */
  fill?: string
}

const REDUCED_MS = 120

/**
 * The circle-plus that becomes a filled circle-check: the one mark of "saved". The two shapes
 * cross-fade on a critically damped spring and the circle pops in from 0.82, no overshoot. With
 * Reduce Motion it is a short fade and no pop. Only opacity and transform animate.
 */
export function SaveMark({ on, size, empty = "plus", color, fill }: Props) {
  const theme = useAmTheme()
  const reduce = useReducedMotion()
  const progress = useSharedValue(on ? 1 : 0)
  const pop = useSharedValue(1)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (reduce) {
      progress.value = withTiming(on ? 1 : 0, { duration: REDUCED_MS })
      return
    }
    progress.value = withSpring(on ? 1 : 0, amSpring.default)
    pop.value = 0.82
    pop.value = withSpring(1, amSpring.default)
  }, [on, reduce, progress, pop])

  const offStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }))
  const onStyle = useAnimatedStyle(() => ({ opacity: progress.value }))
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }))

  const stroke = color ?? theme.textHeading
  const filled = fill ?? theme.brand

  return (
    <Animated.View
      aria-hidden
      pointerEvents="none"
      style={[{ width: size, height: size }, popStyle]}
    >
      <Animated.View style={[styles.layer, offStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={empty === "ring" ? 10 : 9.25} stroke={stroke} strokeWidth={empty === "ring" ? 2 : 1.75} />
          {empty === "plus" ? (
            <Path d="M12 7.75v8.5M7.75 12h8.5" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" />
          ) : null}
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.layer, onStyle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={10.5} fill={filled} />
          <Path d="M7.4 12.4l3.3 3.3 6-6.6" stroke={theme.onBrand} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
})
