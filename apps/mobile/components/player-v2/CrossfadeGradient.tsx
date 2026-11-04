import { useEffect, useRef, useState } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"

type Props = {
  colors: readonly string[]
  locations?: readonly number[]
  start?: { x: number; y: number }
  end?: { x: number; y: number }
  duration?: number
  style?: StyleProp<ViewStyle>
}

type Colors = readonly [string, string, ...string[]]

/**
 * A gradient that crossfades to new colours: the new gradient fades in over the old one, opacity only
 * (never a colour tween on the main thread). With Reduce Motion the change is instant.
 */
export function CrossfadeGradient({ colors, locations, start, end, duration = 400, style }: Props) {
  const reduce = useReducedMotion()
  const [layers, setLayers] = useState<{ base: Colors; top: Colors }>(() => ({ base: colors as Colors, top: colors as Colors }))
  const progress = useSharedValue(1)
  const first = useRef(true)
  const key = colors.join("|")

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setLayers((l) => ({ base: l.top, top: colors as Colors }))
    if (reduce) {
      progress.value = 1
      return
    }
    progress.value = 0
    progress.value = withTiming(1, { duration, easing: Easing.bezier(0.2, 0.7, 0.2, 1) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const topStyle = useAnimatedStyle(() => ({ opacity: progress.value }))
  const common = { locations: locations as unknown as readonly [number, number, ...number[]] | undefined, start, end, style: StyleSheet.absoluteFill }

  return (
    <View pointerEvents="none" style={style}>
      <LinearGradient colors={layers.base} {...common} />
      <Animated.View style={[StyleSheet.absoluteFill, topStyle]}>
        <LinearGradient colors={layers.top} {...common} />
      </Animated.View>
    </View>
  )
}
