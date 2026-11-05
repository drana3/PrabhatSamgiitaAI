import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring, useReducedMotion } from "react-native-reanimated"

import { amSpring } from "@/constants/tokens/amMotion"

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>
  /** scale while the finger is down */
  pressedScale?: number
}

/**
 * Like PressScale, but the style sits on the pressable itself, so `flex`, `alignSelf` and
 * margins take part in the parent's layout. Feedback on touch-down; the spring starts from
 * the current on-screen value.
 */
export function TodayPress({ style, pressedScale = 0.97, ...rest }: Props) {
  const scale = useSharedValue(1)
  const reduce = useReducedMotion()
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animated]}
      onPressIn={(event) => {
        scale.value = reduce ? 1 : withSpring(pressedScale, amSpring.default)
        rest.onPressIn?.(event)
      }}
      onPressOut={(event) => {
        scale.value = reduce ? 1 : withSpring(1, amSpring.default)
        rest.onPressOut?.(event)
      }}
    />
  )
}
