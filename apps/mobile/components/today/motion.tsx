import { useEffect, type ReactNode } from "react"
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { amReveal, amSpring } from "@/constants/tokens/amMotion"

const REVEAL_EASING = Easing.bezier(...amReveal.easing)

/**
 * One staggered reveal per screen: each block rises 16dp and fades in,
 * 80ms after the one before. Only opacity and transform. With reduced
 * motion the rise is dropped and it becomes a cross-fade.
 */
export function Reveal({
  index,
  style,
  children,
}: {
  index: number
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(
      index * amReveal.stepMs,
      withTiming(1, { duration: amReveal.durationMs, easing: REVEAL_EASING }),
    )
  }, [index, progress])

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduce ? 0 : (1 - progress.value) * amReveal.riseDp }],
  }))

  return <Animated.View style={[style, animated]}>{children}</Animated.View>
}

type PressScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>
  /** scale while the finger is down */
  pressedScale?: number
}

/**
 * Feedback on touch-down, not on release. The spring starts from the
 * current on-screen value, so a quick release mid-press never jumps.
 */
export function PressScale({ style, pressedScale = 0.97, children, ...rest }: PressScaleProps) {
  const scale = useSharedValue(1)
  const reduce = useReducedMotion()
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Pressable
      {...rest}
      onPressIn={(event) => {
        scale.value = reduce ? 1 : withSpring(pressedScale, amSpring.default)
        rest.onPressIn?.(event)
      }}
      onPressOut={(event) => {
        scale.value = reduce ? 1 : withSpring(1, amSpring.default)
        rest.onPressOut?.(event)
      }}
    >
      <Animated.View style={[style, animated]}>{children as ReactNode}</Animated.View>
    </Pressable>
  )
}
